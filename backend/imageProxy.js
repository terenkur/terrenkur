const ALLOWED_HOSTS = new Set(['static-cdn.jtvnw.net', 'clips-media-assets2.twitch.tv', 'media.rawg.io', 'i.ytimg.com']);
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_CACHE = 16 * 1024 * 1024;
const FRESH_MS = 60 * 60 * 1000;
const STALE_MS = 24 * FRESH_MS;

function createImageProxy() {
  const cache = new Map();
  const pending = new Map();
  let bytes = 0;
  function remember(key, value) {
    if (cache.has(key)) bytes -= cache.get(key).body.length;
    cache.delete(key);
    cache.set(key, value);
    bytes += value.body.length;
    while (bytes > MAX_CACHE) {
      const oldest = cache.keys().next().value;
      bytes -= cache.get(oldest).body.length;
      cache.delete(oldest);
    }
  }
  async function download(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error('Image upstream failed');
    const type = response.headers.get('content-type') || '';
    if (!/^image\/(jpeg|png|gif|webp|avif)(;|$)/i.test(type)) throw new Error('Unsupported image type');
    if (Number(response.headers.get('content-length')) > MAX_IMAGE) {
      await response.body?.cancel();
      throw new Error('Image too large');
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_IMAGE) throw new Error('Image too large');
      chunks.push(Buffer.from(chunk));
    }
    return { body: Buffer.concat(chunks), type, at: Date.now() };
  }
  return async (req, res) => {
    let target;
    try {
      if (typeof req.query.url !== 'string') throw new Error();
      target = new URL(req.query.url);
      if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname) || target.username || target.password || target.port) throw new Error();
    } catch { return res.status(400).send('Invalid image URL'); }
    const key = target.toString();
    const saved = cache.get(key);
    let image = saved;
    try {
      if (!saved || Date.now() - saved.at > FRESH_MS) {
        if (!pending.has(key)) {
          if (pending.size >= 16) return res.status(503).set('Retry-After', '2').send('Image proxy busy');
          pending.set(key, download(key).then(value => { remember(key, value); return value; }).finally(() => pending.delete(key)));
        }
        image = await pending.get(key);
      }
    } catch (error) {
      if (!saved || Date.now() - saved.at > STALE_MS) {
        const timeout = error.name === 'TimeoutError' || error.name === 'AbortError' || error.cause?.code === 'ETIMEDOUT';
        console.error('Image proxy:', timeout ? 'timeout' : 'upstream failure', target.hostname);
        return res.status(timeout ? 504 : 502).send('Image temporarily unavailable');
      }
      res.set('Warning', '110 - "Response is stale"');
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', image === saved && Date.now() - saved.at > FRESH_MS ? 'public, max-age=60' : 'public, max-age=3600, stale-if-error=86400');
    return res.type(image.type).send(image.body);
  };
}
module.exports = { createImageProxy };
