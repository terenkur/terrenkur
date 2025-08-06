const BASE_URL = 'https://www.googleapis.com/youtube/v3';

function parseTags(text = '') {
  const tags = new Set();
  const regex = /#([\p{L}\p{N}_-]+)/gu;
  let match;
  while ((match = regex.exec(text))) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

async function fetchVideos(apiKey, channelId) {
  const url = `${BASE_URL}/search?key=${apiKey}&channelId=${channelId}&part=snippet&maxResults=50&type=video&order=date`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.items.map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description || '',
    publishedAt: item.snippet.publishedAt,
    thumbnail: item.snippet.thumbnails?.medium?.url,
  }));
}

async function getPlaylists(apiKey, channelId, filterTags) {
  const videos = await fetchVideos(apiKey, channelId);
  let wanted = null;
  if (filterTags) {
    wanted = Array.isArray(filterTags)
      ? filterTags.map((t) => t.toLowerCase())
      : [filterTags.toLowerCase()];
  }
  const map = {};
  videos.forEach((v) => {
    const tags = parseTags(v.description);
    tags.forEach((t) => {
      if (wanted && !wanted.includes(t)) return;
      if (!map[t]) map[t] = [];
      map[t].push({
        id: v.id,
        title: v.title,
        description: v.description,
        publishedAt: v.publishedAt,
        thumbnail: v.thumbnail,
      });
    });
  });
  return map;
}

module.exports = { getPlaylists, parseTags };
