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
  const videos = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      key: apiKey,
      channelId,
      part: 'snippet',
      maxResults: '50',
      type: 'video',
      order: 'date',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `${BASE_URL}/search?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach((item) => {
      videos.push({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description || '',
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url,
      });
    });

    pageToken = data.nextPageToken;
  } while (pageToken);

  return videos;
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
