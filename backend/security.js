const { timingSafeEqual } = require('node:crypto');

function isModeratorFromAuth(user) {
  return user?.app_metadata?.provider === 'email' &&
    user?.app_metadata?.site_moderator === true;
}

function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const actual = req.headers['x-admin-token'];
  if (!expected || typeof actual !== 'string') return res.status(403).json({ error: 'Forbidden' });
  const a = Buffer.from(actual), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function createSecurity(supabase) {
  async function requireModerator(req, res, next) {
    const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    res.set('Cache-Control', 'no-store');
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
      if (!isModeratorFromAuth(data.user)) return res.status(403).json({ error: 'Forbidden' });
      req.authUser = data.user;
      return next();
    } catch {
      return res.status(503).json({ error: 'Authentication unavailable' });
    }
  }
  function requireMusicPlayer(req, res, next) {
    const actual = req.headers['x-music-player-token'];
    if (actual === undefined) return requireModerator(req, res, next);
    res.set('Cache-Control', 'no-store');
    const expected = process.env.MUSIC_QUEUE_PLAYER_TOKEN;
    // A dedicated 256-bit token; never reuse moderator sessions or ADMIN_TOKEN.
    if (!expected || !/^[a-f0-9]{64}$/.test(expected) ||
        typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual) ||
        !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid player token' });
    }
    req.musicPlayerAccess = true;
    return next();
  }
  return { requireModerator, requireMusicPlayer };
}

module.exports = { createSecurity, isModeratorFromAuth, requireAdminToken };
