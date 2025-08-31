const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@supabase/supabase-js');
const { getPlaylists } = require('./youtube');
require('dotenv').config();

const app = express();
const originsEnv =
  process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
const allowedOrigins = originsEnv
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : '*',
  credentials: allowedOrigins.length > 0,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(express.json());

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- OBS event streaming setup ---
const obsClients = new Set();
let obsChannel = null;

async function broadcastObsEvent(payload) {
  const row = payload?.new || {};
  const type = row.type;
  if (
    !type ||
    (!type.startsWith('intim_') && !type.startsWith('poceluy_'))
  ) {
    return;
  }
  try {
    const { data: media } = await supabase
      .from('obs_media')
      .select('gif_url, sound_url')
      .eq('type', type)
      .maybeSingle();
    const event = {
      type,
      message: '',
      gifUrl: media?.gif_url || '',
      soundUrl: media?.sound_url || '',
      timestamp: Date.now(),
    };
    const data = `data: ${JSON.stringify(event)}\n\n`;
    obsClients.forEach((c) => c.write(data));
  } catch (err) {
    console.error('OBS event broadcast error', err);
  }
}

function ensureObsChannel() {
  if (obsChannel) return;
  obsChannel = supabase
    .channel('obs-events')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'event_logs' },
      broadcastObsEvent
    )
    .subscribe();
}

let cachedUserColumns = null;
async function getUserColumns() {
  if (!cachedUserColumns) {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error || !data || data.length === 0) {
      cachedUserColumns = [];
    } else {
      cachedUserColumns = Object.keys(data[0]);
    }
  }
  return cachedUserColumns;
}

async function isValidUserColumn(col) {
  const cols = await getUserColumns();
  return cols.includes(col);
}

let cachedObsTypes = null;
async function getObsTypes() {
  if (!cachedObsTypes) {
    const cols = await getUserColumns();
    cachedObsTypes = cols.filter(
      (c) => c.startsWith('intim_') || c.startsWith('poceluy_')
    );
  }
  return cachedObsTypes;
}

const INTIM_COLUMNS = [
  'intim_no_tag_0',
  'intim_no_tag_69',
  'intim_no_tag_100',
  'intim_with_tag_0',
  'intim_with_tag_69',
  'intim_with_tag_100',
  'intim_self_no_tag',
  'intim_self_no_tag_0',
  'intim_self_no_tag_69',
  'intim_self_no_tag_100',
  'intim_self_with_tag',
  'intim_self_with_tag_0',
  'intim_self_with_tag_69',
  'intim_self_with_tag_100',
  'intim_tagged_equals_partner',
  'intim_tagged_equals_partner_0',
  'intim_tagged_equals_partner_69',
  'intim_tagged_equals_partner_100',
  'intim_tag_match_success',
  'intim_tag_match_success_0',
  'intim_tag_match_success_69',
  'intim_tag_match_success_100',
];

const POCELUY_COLUMNS = [
  'poceluy_no_tag_0',
  'poceluy_no_tag_69',
  'poceluy_no_tag_100',
  'poceluy_with_tag_0',
  'poceluy_with_tag_69',
  'poceluy_with_tag_100',
  'poceluy_self_no_tag',
  'poceluy_self_no_tag_0',
  'poceluy_self_no_tag_69',
  'poceluy_self_no_tag_100',
  'poceluy_self_with_tag',
  'poceluy_self_with_tag_0',
  'poceluy_self_with_tag_69',
  'poceluy_self_with_tag_100',
  'poceluy_tagged_equals_partner',
  'poceluy_tagged_equals_partner_0',
  'poceluy_tagged_equals_partner_69',
  'poceluy_tagged_equals_partner_100',
  'poceluy_tag_match_success',
  'poceluy_tag_match_success_0',
  'poceluy_tag_match_success_69',
  'poceluy_tag_match_success_100',
];

const TOTAL_COLUMNS = [
  'total_streams_watched',
  'total_subs_gifted',
  'total_subs_received',
  'total_chat_messages_sent',
  'total_times_tagged',
  'total_commands_run',
  'total_months_subbed',
  'clips_created',
  'combo_commands',
];
const MEDAL_TYPES = ['gold', 'silver', 'bronze'];
const EXCLUDED_MEDAL_USERNAMES = new Set([
  'terrenkur',
  'hornypaps',
  'streamelements',
]);

async function getTopByColumns(columns, limit = 5) {
  const { data, error } = await supabase
    .from('users')
    .select(['id', 'username', ...columns].join(', '));
  if (error) throw error;
  const rows = data || [];
  const stats = {};
  for (const col of columns) {
    stats[col] = rows
      .map((u) => ({ id: u.id, username: u.username, value: u[col] || 0 }))
      .filter(
        (u) =>
          u.value > 0 &&
          !EXCLUDED_MEDAL_USERNAMES.has((u.username || '').toLowerCase())
      )
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }
  return stats;
}

async function getTopVoters(limit = 5) {
  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('user_id');
  if (votesErr) throw votesErr;

  const counts = (votes || []).reduce((acc, v) => {
    acc[v.user_id] = (acc[v.user_id] || 0) + 1;
    return acc;
  }, {});

  const ids = Object.keys(counts).map((id) => parseInt(id, 10));
  if (ids.length === 0) return [];

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, username')
    .in('id', ids);
  if (usersErr) throw usersErr;

  return users
    .map((u) => ({ id: u.id, username: u.username, votes: counts[u.id] || 0 }))
    .filter(
      (u) => !EXCLUDED_MEDAL_USERNAMES.has((u.username || '').toLowerCase())
    )
    .sort((a, b) => b.votes - a.votes)
    .slice(0, limit);
}

async function getTopRouletteUsers(limit = 5) {
  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('user_id, poll_id');
  if (votesErr) throw votesErr;
  const userPolls = votes.reduce((acc, v) => {
    if (!acc[v.user_id]) acc[v.user_id] = new Set();
    acc[v.user_id].add(v.poll_id);
    return acc;
  }, {});
  const ids = Object.keys(userPolls).map((id) => parseInt(id, 10));
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, username')
    .in('id', ids.length > 0 ? ids : [0]);
  if (usersErr) throw usersErr;
  return users
    .map((u) => ({
      id: u.id,
      username: u.username,
      roulettes: userPolls[u.id]?.size || 0,
    }))
    .filter(
      (u) => !EXCLUDED_MEDAL_USERNAMES.has((u.username || '').toLowerCase())
    )
    .sort((a, b) => b.roulettes - a.roulettes)
    .slice(0, limit);
}

function medalFromList(list, userId) {
  const index = list.findIndex((e) => e.id === userId);
  return index >= 0 && index < MEDAL_TYPES.length
    ? MEDAL_TYPES[index]
    : null;
}

// Exchange Twitch OAuth code for an access token
app.post('/auth/twitch-token', async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code is required' });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_SECRET;
  const redirect = process.env.OAUTH_CALLBACK_URL;
  if (!clientId || !secret || !redirect) {
    return res.status(500).json({ error: 'Twitch OAuth not configured' });
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    });

    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await resp.text();
    res.status(resp.status).type('application/json').send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

// Simple image proxy to add CORS headers
const ALLOWED_PROXY_HOSTS = [
  'static-cdn.jtvnw.net',
  'clips-media-assets2.twitch.tv',
  'media.rawg.io',
  'i.ytimg.com',
];

app.get('/api/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('url query parameter required');
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).send('Invalid url');
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).send('Invalid url');
  }
  if (!ALLOWED_PROXY_HOSTS.includes(target.hostname)) {
    return res.status(400).send('Host not allowed');
  }

  try {
    const resp = await fetch(target.toString(), {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return res.status(resp.status).send('Failed to fetch image');
    }
    res.set('Access-Control-Allow-Origin', '*');
    const type = resp.headers.get('content-type');
    if (type) res.type(type);
    const buf = Buffer.from(await resp.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error('Image proxy error:', err);
    console.error('Cause:', err.cause, 'URL:', req.query.url);
    if (err.cause?.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Image fetch timed out' });
    }
    res.status(500).send('Proxy error');
  }
});

// Proxy selected Twitch Helix endpoints using server credentials
app.get('/api/get-stream', async (req, res) => {
  const endpoint = req.query.endpoint;
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).send('endpoint query parameter required');
  }
  const authHeader = req.headers['authorization'] || '';
  let token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'TWITCH_CLIENT_ID not configured' });
  }


  const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'endpoint' && typeof value === 'string') {
      url.searchParams.append(key, value);
    }
  });
  try {
    const resp = await fetch(url.toString(), {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    });
    const text = await resp.text();
    res.status(resp.status).type('application/json').send(text);
  } catch (err) {
    console.error('Twitch proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch Twitch API' });
  }
});

const ENABLE_TWITCH_ROLE_CHECKS =
  process.env.ENABLE_TWITCH_ROLE_CHECKS === 'true';

// Provide a pre-authorized streamer token for role checks
if (ENABLE_TWITCH_ROLE_CHECKS) {
  app.get('/api/streamer-token', async (_req, res) => {
    const { data, error } = await supabase
      .from('twitch_tokens')
      .select('access_token')
      .maybeSingle();
    const token = data?.access_token;
    if (error || !token) {
      return res
        .status(404)
        .json({ error: 'Streamer token not configured' });
    }
    res.json({ token });
  });
}

app.get('/refresh-token', async (_req, res) => {
  let refreshToken = process.env.TWITCH_REFRESH_TOKEN || null;

  const { data: row, error: selErr } = await supabase
    .from('twitch_tokens')
    .select('id, refresh_token')
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (row && row.refresh_token) refreshToken = row.refresh_token;

  if (!refreshToken) {
    return res.status(500).json({ error: 'Refresh token not configured' });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_SECRET;
  if (!clientId || !secret) {
    return res
      .status(500)
      .json({ error: 'Twitch credentials not configured' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: secret,
    });
    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    const expiresAt = new Date(
      Date.now() + (data.expires_in || 0) * 1000
    ).toISOString();
    const update = {
      access_token: data.access_token,
      expires_at: expiresAt,
    };
    if (data.refresh_token) {
      update.refresh_token = data.refresh_token;
    } else {
      update.refresh_token = refreshToken;
    }
    let upErr;
    if (row) {
      ({ error: upErr } = await supabase
        .from('twitch_tokens')
        .update(update)
        .eq('id', row.id));
    } else {
      ({ error: upErr } = await supabase
        .from('twitch_tokens')
        .insert(update));
    }
    if (upErr) {
      return res.status(500).json({ error: upErr.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Refresh token failed', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

app.get('/refresh-token/bot', async (_req, res) => {
  let refreshToken = process.env.BOT_REFRESH_TOKEN || null;

  const { data: row, error: selErr } = await supabase
    .from('bot_tokens')
    .select('id, refresh_token')
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (row && row.refresh_token) refreshToken = row.refresh_token;

  if (!refreshToken) {
    return res.status(500).json({ error: 'Refresh token not configured' });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_SECRET;
  if (!clientId || !secret) {
    return res
      .status(500)
      .json({ error: 'Twitch credentials not configured' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: secret,
    });
    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    const expiresAt = new Date(
      Date.now() + (data.expires_in || 0) * 1000
    ).toISOString();
    const update = {
      access_token: data.access_token,
      expires_at: expiresAt,
    };
    if (data.refresh_token) {
      update.refresh_token = data.refresh_token;
    } else {
      update.refresh_token = refreshToken;
    }
    let upErr;
    if (row) {
      ({ error: upErr } = await supabase
        .from('bot_tokens')
        .update(update)
        .eq('id', row.id));
    } else {
      ({ error: upErr } = await supabase.from('bot_tokens').insert(update));
    }
    if (upErr) {
      return res.status(500).json({ error: upErr.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Refresh bot token failed', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

app.post('/refresh-token/donationalerts', async (_req, res) => {
  let refreshToken = process.env.DONATIONALERTS_REFRESH_TOKEN || null;

  const { data: row, error: selErr } = await supabase
    .from('donationalerts_tokens')
    .select('id, refresh_token')
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (row && row.refresh_token) refreshToken = row.refresh_token;

  if (!refreshToken) {
    return res
      .status(500)
      .json({ error: 'Refresh token not configured' });
  }

  const clientId = process.env.DONATIONALERTS_CLIENT_ID;
  const secret = process.env.DONATIONALERTS_SECRET;
  if (!clientId || !secret) {
    return res
      .status(500)
      .json({ error: 'DonationAlerts credentials not configured' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: secret,
    });
    const resp = await fetch('https://www.donationalerts.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    const expiresAt = new Date(
      Date.now() + (data.expires_in || 0) * 1000
    ).toISOString();
    const update = {
      access_token: data.access_token,
      expires_at: expiresAt,
    };
    if (data.refresh_token) {
      update.refresh_token = data.refresh_token;
    } else {
      update.refresh_token = refreshToken;
    }
    let upErr;
    if (row) {
      ({ error: upErr } = await supabase
        .from('donationalerts_tokens')
        .update(update)
        .eq('id', row.id));
    } else {
      ({ error: upErr } = await supabase
        .from('donationalerts_tokens')
        .insert(update));
    }
    if (upErr) {
      return res.status(500).json({ error: upErr.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DonationAlerts refresh token failed', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

let twitchToken = null;
let twitchExpiry = 0;

async function getTwitchToken() {
  const now = Math.floor(Date.now() / 1000);
  if (twitchToken && twitchExpiry - 60 > now) return twitchToken;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_SECRET;
  if (!clientId || !secret) {
    throw new Error('Twitch credentials not configured');
  }

  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${secret}&grant_type=client_credentials`;
  const resp = await fetch(url, { method: 'POST' });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Auth failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  twitchToken = data.access_token;
  twitchExpiry = now + (data.expires_in || 0);
  return twitchToken;
}

app.get('/api/twitch_videos', async (_req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const channelId = process.env.TWITCH_CHANNEL_ID;
  if (!clientId || !channelId || !process.env.TWITCH_SECRET) {
    return res.status(500).json({ error: 'Twitch API not configured' });
  }

  try {
    const token = await getTwitchToken();
    const url = new URL('https://api.twitch.tv/helix/videos');
    url.searchParams.set('user_id', channelId);
    url.searchParams.set('first', '20');
    url.searchParams.set('type', 'archive');
    const resp = await fetch(url.toString(), {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    res.json({ videos: data.data || [] });
  } catch (err) {
    console.error('Twitch videos error:', err);
    res.status(500).json({ error: 'Failed to fetch Twitch videos' });
  }
});

app.get('/api/twitch_clips', async (_req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const channelId = process.env.TWITCH_CHANNEL_ID;
  if (!clientId || !channelId || !process.env.TWITCH_SECRET) {
    return res.status(500).json({ error: 'Twitch API not configured' });
  }

  try {
    const token = await getTwitchToken();
    const url = new URL('https://api.twitch.tv/helix/clips');
    url.searchParams.set('broadcaster_id', channelId);
    url.searchParams.set('first', '20');
    const resp = await fetch(url.toString(), {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    const clips = (data.data || []).map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      thumbnail_url: c.thumbnail_url,
    }));
    res.json({ clips });
  } catch (err) {
    console.error('Twitch clips error:', err);
    res.status(500).json({ error: 'Failed to fetch Twitch clips' });
  }
});

async function logEvent(message, type) {
  try {
    await supabase.from('event_logs').insert({ message, type });
  } catch (err) {
    console.error('Failed to log event', err);
  }
}

async function requireModerator(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('is_moderator')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });
  if (!user || !user.is_moderator) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.authUser = authUser;
  next();
}

async function buildPollResponse(poll) {
  const { data: pollGames, error: pgError } = await supabase
    .from('poll_games')
    .select('game_id')
    .eq('poll_id', poll.id);
  if (pgError) return { error: pgError };

  const gameIds = pollGames.map((pg) => pg.game_id);
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name, background_image')
    .in('id', gameIds.length > 0 ? gameIds : [0]);
  if (gamesError) return { error: gamesError };

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('game_id, user_id')
    .eq('poll_id', poll.id);
  if (votesError) return { error: votesError };

  const userIds = [...new Set(votes.map((v) => v.user_id))];
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username')
    .in('id', userIds.length > 0 ? userIds : [0]);
  if (usersError) return { error: usersError };

  const userMap = users.reduce((acc, u) => {
    acc[u.id] = u.username;
    return acc;
  }, {});

  const counts = votes.reduce((acc, v) => {
    acc[v.game_id] = (acc[v.game_id] || 0) + 1;
    return acc;
  }, {});

  const voterMap = votes.reduce((acc, v) => {
    const name = userMap[v.user_id];
    if (!name) return acc;
    if (!acc[v.game_id]) acc[v.game_id] = {};
    if (!acc[v.game_id][v.user_id]) {
      acc[v.game_id][v.user_id] = { id: v.user_id, username: name, count: 0 };
    }
    acc[v.game_id][v.user_id].count += 1;
    return acc;
  }, {});

  const nicknames = {};
  for (const [gid, map] of Object.entries(voterMap)) {
    nicknames[gid] = Object.values(map).sort((a, b) => b.count - a.count);
  }

  const results = games.map((g) => ({
    id: g.id,
    name: g.name,
    background_image: g.background_image,
    count: counts[g.id] || 0,
    nicknames: nicknames[g.id] || [],
  }));

  return {
    poll_id: poll.id,
    created_at: poll.created_at,
    archived: poll.archived,
    games: results,
  };
}

// Ensure the Supabase auth user has a linked Twitch login. If the auth ID
// isn't yet associated with a user record, try to find an existing user by
// username or twitch_login before failing.
app.post('/api/ensure-twitch-login', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const twitchLogin = (
    authUser.user_metadata?.preferred_username ||
    authUser.user_metadata?.name ||
    ''
  ).toLowerCase();

  if (!twitchLogin) {
    return res.json({ success: true });
  }

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, twitch_login')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (userErr) return res.status(500).json({ error: userErr.message });
  if (!userRow) {
    const { data: existingUser, error: findErr } = await supabase
      .from('users')
      .select('id')
      .or(`username.ilike.${twitchLogin},twitch_login.ilike.${twitchLogin}`)
      .maybeSingle();
    if (findErr) return res.status(500).json({ error: findErr.message });
    if (!existingUser)
      return res.status(404).json({ error: 'User not found' });
    const { error: attachErr } = await supabase
      .from('users')
      .update({ auth_id: authUser.id, twitch_login: twitchLogin })
      .eq('id', existingUser.id);
    if (attachErr) return res.status(500).json({ error: attachErr.message });
    return res.json({ success: true, twitch_login: twitchLogin });
  }

  if (!userRow.twitch_login) {
    const { error: updateErr } = await supabase
      .from('users')
      .update({ twitch_login: twitchLogin })
      .eq('id', userRow.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
  }

  res.json({ success: true, twitch_login: twitchLogin });
});

app.post('/api/user/theme', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { theme } = req.body;
  if (!theme || typeof theme !== 'string') {
    return res.status(400).json({ error: 'theme is required' });
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ theme })
    .eq('id', user.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ success: true });
});

app.get('/api/user/theme', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('theme')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  res.json({ theme: data?.theme || 'system' });
});

app.get('/api/data', async (req, res) => {
  const { data, error } = await supabase.from('items').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get the most recent poll with aggregated vote counts
app.get('/api/poll', async (_req, res) => {
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pollError) return res.status(500).json({ error: pollError.message });
  if (!poll) return res.status(404).json({ error: 'No poll found' });

  const result = await buildPollResponse(poll);
  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }
  res.json(result);
});

// Get a specific poll by id
app.get('/api/poll/:id', async (req, res) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) {
    return res.status(400).json({ error: 'Invalid poll id' });
  }
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('*')
    .eq('id', pollId)
    .maybeSingle();
  if (pollError) return res.status(500).json({ error: pollError.message });
  if (!poll) return res.status(404).json({ error: 'Poll not found' });

  const result = await buildPollResponse(poll);
  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }
  res.json(result);
});

// List all polls
app.get('/api/polls', async (_req, res) => {
  const { data, error } = await supabase
    .from('polls')
    .select('id, created_at, archived')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ polls: data });
});

// Create a new poll (moderators only)
app.post('/api/polls', requireModerator, async (req, res) => {

  const { data: lastPoll, error: pollErr } = await supabase
    .from('polls')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pollErr) return res.status(500).json({ error: pollErr.message });

  let defaultIds = [];
  if (lastPoll) {
    const { data: lastGames, error: lastGamesErr } = await supabase
      .from('poll_games')
      .select('game_id')
      .eq('poll_id', lastPoll.id);
    if (lastGamesErr) return res.status(500).json({ error: lastGamesErr.message });
    defaultIds = lastGames.map((g) => g.game_id);
  }

  let { game_ids, archived } = req.body;
  if (!Array.isArray(game_ids) || game_ids.length === 0) {
    game_ids = defaultIds;
  }
  if (!Array.isArray(game_ids) || game_ids.length === 0) {
    return res.status(400).json({ error: 'game_ids is required' });
  }

  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id')
    .in('id', game_ids);
  if (gamesErr) return res.status(500).json({ error: gamesErr.message });
  if ((games || []).length !== game_ids.length) {
    return res.status(400).json({ error: 'Some game_ids do not exist' });
  }

  archived = archived ? true : false;

  const { data: newPoll, error: insertErr } = await supabase
    .from('polls')
    .insert({ archived })
    .select('id')
    .single();
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  const rows = game_ids.map((id) => ({ poll_id: newPoll.id, game_id: id }));
  if (rows.length > 0) {
    const { error: pgErr } = await supabase.from('poll_games').insert(rows);
    if (pgErr) {
      await supabase.from('polls').delete().eq('id', newPoll.id);
      return res.status(500).json({ error: pgErr.message });
    }
  }

  const { error: resetErr } = await supabase
    .from('users')
    .update({ vote_limit: 1 });
  if (resetErr) return res.status(500).json({ error: resetErr.message });

  res.json({ poll_id: newPoll.id });
});

// Archive an existing poll (moderators only)
app.post('/api/polls/:id/archive', requireModerator, async (req, res) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) {
    return res.status(400).json({ error: 'Invalid poll id' });
  }


  const { data, error } = await supabase
    .from('polls')
    .update({ archived: true })
    .eq('id', pollId)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  res.json(data || { success: true });
});

// Record a vote for a specific game in a poll
app.post('/api/vote', async (req, res) => {
  let { poll_id, game_id, slot, username } = req.body;
  if (!poll_id) {
    return res.status(400).json({ error: 'poll_id is required' });
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const twitchLogin = (
    authUser.user_metadata?.preferred_username ||
    authUser.user_metadata?.name ||
    null
  )?.toLowerCase();

  const { data: acc, error: accErr } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'accept_votes')
    .maybeSingle();
  if (accErr) return res.status(500).json({ error: accErr.message });
  if (acc && Number(acc.value) === 0) {
    return res.status(403).json({ error: 'Voting closed' });
  }

  const { data: editS, error: editErr } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'allow_edit')
    .maybeSingle();
  if (editErr) return res.status(500).json({ error: editErr.message });
  const canEdit = !editS || Number(editS.value) !== 0;

  if (game_id !== null) {
    const { data: allowedGame, error: allowedError } = await supabase
      .from('poll_games')
      .select('poll_id')
      .eq('poll_id', poll_id)
      .eq('game_id', game_id)
      .maybeSingle();
    if (allowedError)
      return res.status(500).json({ error: allowedError.message });
    if (!allowedGame)
      return res.status(400).json({ error: 'Invalid game for poll' });
  }

  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });

  if (!user) {
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }
    const { data: existingUser, error: existError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (existError) return res.status(500).json({ error: existError.message });
    if (existingUser) {
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ auth_id: authUser.id, twitch_login: twitchLogin })
        .eq('id', existingUser.id)
        .select()
        .single();
      if (updateError) return res.status(500).json({ error: updateError.message });
      user = updated;
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ auth_id: authUser.id, username, twitch_login: twitchLogin })
        .select()
        .single();
      if (insertError) return res.status(500).json({ error: insertError.message });
      user = newUser;
    }
  } else if (username && user.username !== username) {
    // Update username if it changed
    await supabase.from('users').update({ username }).eq('id', user.id);
  }

  if (twitchLogin && user.twitch_login !== twitchLogin) {
    await supabase
      .from('users')
      .update({ twitch_login: twitchLogin })
      .eq('id', user.id);
    user.twitch_login = twitchLogin;
  }

  const { data: existingVotes, error: votesError } = await supabase
    .from('votes')
    .select('id, slot')
    .eq('poll_id', poll_id)
    .eq('user_id', user.id);
  if (votesError) {
    return res.status(500).json({ error: votesError.message });
  }

  const limit = user.vote_limit || 1;

  const current = existingVotes || [];
  const existing = current.find((v) => v.slot === slot);

  if (game_id === null) {
    if (existing) {
      if (!canEdit) {
        return res.status(403).json({ error: 'Editing votes disabled' });
      }
      const { error: delError } = await supabase
        .from('votes')
        .delete()
        .eq('id', existing.id);
      if (delError) {
        return res.status(500).json({ error: delError.message });
      }
      logEvent(`${user.username} removed vote from slot ${slot}`);
      return res.status(200).json({ success: true, deleted: true });
    }
    return res.status(404).json({ error: 'Vote not found for slot' });
  }

  if (!slot) {
    const used = current.map((v) => v.slot);
    for (let i = 1; i <= limit; i++) {
      if (!used.includes(i)) {
        slot = i;
        break;
      }
    }
    if (!slot) {
      return res.status(400).json({ error: 'Vote limit reached' });
    }
  } else if (slot > limit) {
    return res.status(400).json({ error: 'slot exceeds vote_limit' });
  }

  if (existing) {
    if (!canEdit) {
      return res.status(403).json({ error: 'Editing votes disabled' });
    }
    const { error: updateError } = await supabase
      .from('votes')
      .update({ game_id })
      .eq('id', existing.id);
    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }
    const { data: g } = await supabase
      .from('games')
      .select('name')
      .eq('id', game_id)
      .maybeSingle();
    logEvent(`${user.username} revoted slot ${slot} to ${g ? g.name : game_id}`);
    return res.status(200).json({ success: true, updated: true });
  }

  if (current.length >= limit) {
    return res.status(400).json({ error: 'Vote limit reached' });
  }

  const { error: voteError } = await supabase.from('votes').insert({
    poll_id,
    game_id,
    user_id: user.id,
    slot,
  });

  if (voteError) {
    return res.status(500).json({ error: voteError.message });
  }
  const { data: g } = await supabase
    .from('games')
    .select('name')
    .eq('id', game_id)
    .maybeSingle();
  logEvent(`${user.username} voted for ${g ? g.name : game_id}`);
  res.status(201).json({ success: true });
});

// Update vote limit for a user (simple admin token check)
app.post('/api/set_vote_limit', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { user_id, vote_limit } = req.body;
  if (!user_id || typeof vote_limit !== 'number') {
    return res.status(400).json({ error: 'user_id and vote_limit are required' });
  }
  const { error } = await supabase
    .from('users')
    .update({ vote_limit })
    .eq('id', user_id);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

// Get current wheel coefficient
app.get('/api/voice_coeff', async (_req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'wheel_coeff')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  const coeff = data ? Number(data.value) : 2;
  res.json({ coeff });
});

// Update wheel coefficient (moderators only)
app.post('/api/voice_coeff', requireModerator, async (req, res) => {

  const { coeff } = req.body;
  if (typeof coeff !== 'number') {
    return res.status(400).json({ error: 'coeff must be a number' });
  }

  const { error: upError } = await supabase
    .from('settings')
    .upsert({ key: 'wheel_coeff', value: coeff });
  if (upError) return res.status(500).json({ error: upError.message });

  res.json({ success: true });
});

// Get current zero vote weight
app.get('/api/zero_vote_weight', async (_req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'zero_vote_weight')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  const weight = data ? Number(data.value) : 40;
  res.json({ weight });
});

// Update zero vote weight (moderators only)
app.post('/api/zero_vote_weight', requireModerator, async (req, res) => {

  const { weight } = req.body;
  if (typeof weight !== 'number') {
    return res.status(400).json({ error: 'weight must be a number' });
  }

  const { error: upError } = await supabase
    .from('settings')
    .upsert({ key: 'zero_vote_weight', value: weight });
  if (upError) return res.status(500).json({ error: upError.message });

  res.json({ success: true });
});

// Get accept_votes setting
app.get('/api/accept_votes', async (_req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'accept_votes')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  const value = data ? Number(data.value) : 1;
  res.json({ value });
});

// Update accept_votes (moderators only)
app.post('/api/accept_votes', requireModerator, async (req, res) => {

  const { value } = req.body;
  const num = value ? 1 : 0;
  const { error: upError } = await supabase
    .from('settings')
    .upsert({ key: 'accept_votes', value: num });
  if (upError) return res.status(500).json({ error: upError.message });

  res.json({ success: true });
});

// Get allow_edit setting
app.get('/api/allow_edit', async (_req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'allow_edit')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  const value = data ? Number(data.value) : 1;
  res.json({ value });
});

// Update allow_edit (moderators only)
app.post('/api/allow_edit', requireModerator, async (req, res) => {

  const { value } = req.body;
  const num = value ? 1 : 0;
  const { error: upError } = await supabase
    .from('settings')
    .upsert({ key: 'allow_edit', value: num });
  if (upError) return res.status(500).json({ error: upError.message });

  res.json({ success: true });
});

// Get reward IDs to log
app.get('/api/log_reward_ids', async (_req, res) => {
  const { data, error } = await supabase
    .from('log_rewards')
    .select('reward_id');
  if (error) return res.status(500).json({ error: error.message });
  const ids = (data || []).map((r) => r.reward_id);
  res.json({ ids });
});

// Update reward IDs to log (moderators only)
app.post('/api/log_reward_ids', requireModerator, async (req, res) => {
  let { ids } = req.body;
  if (!Array.isArray(ids)) ids = [];
  const { error: delErr } = await supabase.from('log_rewards').delete().neq('reward_id', '');
  if (delErr) return res.status(500).json({ error: delErr.message });
  if (ids.length > 0) {
    const rows = ids.filter(Boolean).map((id) => ({ reward_id: id }));
    const { error: insErr } = await supabase.from('log_rewards').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }
  res.json({ success: true });
});

// List all users
app.get('/api/users', async (req, res) => {
  const search = req.query.search || req.query.q;
  let builder = supabase.from('users').select('*');
  if (search) {
    builder = builder.ilike('username', `%${search}%`);
  }
  builder = builder
    .order('auth_id', { ascending: false, nullsFirst: false })
    .order('username', { ascending: true });
  const { data, error } = await builder;
  if (error) return res.status(500).json({ error: error.message });
  const users = (data || []).map((u) => {
    const base = {
      id: u.id,
      username: u.username,
      auth_id: u.auth_id,
      twitch_login: u.twitch_login,
      total_streams_watched: u.total_streams_watched,
      total_subs_gifted: u.total_subs_gifted,
      total_subs_received: u.total_subs_received,
      total_chat_messages_sent: u.total_chat_messages_sent,
      total_times_tagged: u.total_times_tagged,
      total_commands_run: u.total_commands_run,
      total_months_subbed: u.total_months_subbed,
      clips_created: u.clips_created,
      combo_commands: u.combo_commands,
      logged_in: !!u.auth_id,
    };
    for (const [key, value] of Object.entries(u)) {
      if (key.startsWith('intim_') || key.startsWith('poceluy_')) {
        base[key] = value;
      }
    }
    return base;
  });
  res.json({ users });
});

// Get a user's vote history
app.get('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const { data: row, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });
  if (!row) return res.status(404).json({ error: 'User not found' });

  const baseUser = {
    id: row.id,
    username: row.username,
    auth_id: row.auth_id,
    twitch_login: row.twitch_login,
    total_streams_watched: row.total_streams_watched,
    total_subs_gifted: row.total_subs_gifted,
    total_subs_received: row.total_subs_received,
    total_chat_messages_sent: row.total_chat_messages_sent,
    total_times_tagged: row.total_times_tagged,
    total_commands_run: row.total_commands_run,
    total_months_subbed: row.total_months_subbed,
    clips_created: row.clips_created,
    combo_commands: row.combo_commands,
  };

  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('intim_') || key.startsWith('poceluy_')) {
      baseUser[key] = value;
    }
  }

  const user = baseUser;

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('poll_id, game_id')
    .eq('user_id', userId);
  if (votesError) return res.status(500).json({ error: votesError.message });

  const pollIds = [...new Set(votes.map((v) => v.poll_id))];
  const gameIds = [...new Set(votes.map((v) => v.game_id))];

  if (user) {
    user.votes = votes.length;
    user.roulettes = pollIds.length;
  }

  const { data: polls, error: pollsError } = await supabase
    .from('polls')
    .select('id, created_at, archived')
    .in('id', pollIds.length > 0 ? pollIds : [0]);
  if (pollsError) return res.status(500).json({ error: pollsError.message });

  const { data: pollResults, error: resultsError } = await supabase
    .from('poll_results')
    .select('poll_id, winner_id')
    .in('poll_id', pollIds.length > 0 ? pollIds : [0]);
  if (resultsError)
    return res.status(500).json({ error: resultsError.message });

  const resultMap = (pollResults || []).reduce((acc, r) => {
    acc[r.poll_id] = r.winner_id;
    return acc;
  }, {});

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name')
    .in('id', gameIds.length > 0 ? gameIds : [0]);
  if (gamesError) return res.status(500).json({ error: gamesError.message });

  const gameMap = games.reduce((acc, g) => {
    acc[g.id] = g.name;
    return acc;
  }, {});

  const pollMap = polls.reduce((acc, p) => {
    acc[p.id] = {
      id: p.id,
      created_at: p.created_at,
      archived: p.archived,
      winner_id: resultMap[p.id] || null,
      games: [],
    };
    return acc;
  }, {});

  votes.forEach((v) => {
    const entry = pollMap[v.poll_id];
    if (!entry) return;
    if (!entry.games.find((g) => g.id === v.game_id)) {
      entry.games.push({ id: v.game_id, name: gameMap[v.game_id] });
    }
  });

  const history = Object.values(pollMap).sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  if (user) {
    user.logged_in = !!user.auth_id;
  }
  res.json({ user, history });
});

// Search RAWG for games
app.get('/api/rawg_search', async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }
  const key = process.env.RAWG_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'RAWG_API_KEY not configured' });
  }
  try {
    const url = `https://api.rawg.io/api/games?key=${key}&search=${encodeURIComponent(query)}&page_size=5`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      console.error('RAWG search error', text);
      return res.status(500).json({ error: 'RAWG API error' });
    }
    const data = await resp.json();
    const results = (data.results || []).map((g) => ({
      rawg_id: g.id,
      name: g.name,
      background_image: g.background_image,
    }));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch RAWG data' });
  }
});

// Add a game to a poll (moderators only)
app.post('/api/games', requireModerator, async (req, res) => {

  let {
    poll_id,
    rawg_id,
    name,
    background_image,
    released_year,
    genres,
    game_id,
  } = req.body;
  if (!name && !rawg_id) {
    return res
      .status(400)
      .json({ error: 'name or rawg_id must be provided' });
  }

  if (rawg_id) {
    const key = process.env.RAWG_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'RAWG_API_KEY not configured' });
    }
    try {
      const resp = await fetch(
        `https://api.rawg.io/api/games/${rawg_id}?key=${key}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (!name) name = data.name;
        if (!background_image) background_image = data.background_image;
        if (!released_year && data.released)
          released_year = new Date(data.released).getFullYear();
        if ((!genres || genres.length === 0) && Array.isArray(data.genres))
          genres = data.genres.map((g) => g.name);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  let game;
  if (game_id) {
    const { data: g, error: gErr } = await supabase
      .from('games')
      .select('id, status')
      .eq('id', game_id)
      .maybeSingle();
    if (gErr) return res.status(500).json({ error: gErr.message });
    if (!g) return res.status(404).json({ error: 'Game not found' });
    game = g;
  } else {
    const { data: g, error: gameErr } = await supabase
      .from('games')
      .select('id, status')
      .eq('name', name)
      .limit(1)
      .maybeSingle();
    if (gameErr) return res.status(500).json({ error: gameErr.message });
    game = g || null;
  }

  if (!game) {
    const { data: newGame, error: insErr } = await supabase
      .from('games')
      .insert({
        name,
        background_image,
        released_year: released_year || null,
        genres: genres && genres.length ? genres : null,
      })
      .select('id')
      .single();
    if (insErr) return res.status(500).json({ error: insErr.message });
    game = newGame;
  } else if (background_image || released_year || (genres && genres.length)) {
    const updateData = {};
    if (background_image) updateData.background_image = background_image;
    if (released_year) updateData.released_year = released_year;
    if (genres && genres.length) updateData.genres = genres;
    await supabase.from('games').update(updateData).eq('id', game.id);
  }

  if (!poll_id) {
    const { data: poll, error: pollErr } = await supabase
      .from('polls')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pollErr) return res.status(500).json({ error: pollErr.message });
    if (!poll) return res.status(400).json({ error: 'No poll found' });
    poll_id = poll.id;
  }

  const { error: pgErr } = await supabase
    .from('poll_games')
    .upsert({ poll_id, game_id: game.id }, { onConflict: 'poll_id,game_id' });
  if (pgErr) return res.status(500).json({ error: pgErr.message });

  res.json({ success: true, game_id: game.id, poll_id });
});

// List games with status and initiators
app.get('/api/games', async (req, res) => {
  const {
    search,
    status,
    method,
    genres,
    yearMin,
    yearMax,
    ratingMin,
    ratingMax,
  } = req.query;

  const { data: poll } = await supabase
    .from('polls')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeIds = [];
  if (poll) {
    const { data: pollGames, error: pgErr } = await supabase
      .from('poll_games')
      .select('game_id')
      .eq('poll_id', poll.id);
    if (pgErr) return res.status(500).json({ error: pgErr.message });
    activeIds = pollGames.map((pg) => pg.game_id);
  }

  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select(
      'id, rawg_id, name, status, rating, selection_method, background_image, released_year, genres'
    );
  if (gamesErr) return res.status(500).json({ error: gamesErr.message });

  const { data: inits, error: initErr } = await supabase
    .from('game_initiators')
    .select('game_id, user_id');
  if (initErr) return res.status(500).json({ error: initErr.message });

  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, username');
  if (userErr) return res.status(500).json({ error: userErr.message });

  const userMap = users.reduce((acc, u) => {
    acc[u.id] = u.username;
    return acc;
  }, {});

  const initMap = {};
  inits.forEach((i) => {
    if (!initMap[i.game_id]) initMap[i.game_id] = [];
    const name = userMap[i.user_id];
    if (name) initMap[i.game_id].push({ id: i.user_id, username: name });
  });

  const activeSet = new Set(activeIds);

  const genreSet = new Set();
  games.forEach((g) => {
    if (Array.isArray(g.genres)) {
      g.genres.forEach((gen) => genreSet.add(gen));
    }
  });
  const availableGenres = Array.from(genreSet).sort();

  let result = games.map((g) => ({
    id: g.id,
    rawg_id: g.rawg_id,
    name: g.name,
    background_image: g.background_image,
    released_year: g.released_year,
    genres: g.genres,
    status: activeSet.has(g.id) ? 'active' : g.status || 'backlog',
    rating: g.rating,
    selection_method: g.selection_method,
    initiators: initMap[g.id] || [],
  }));

  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    result = result.filter((g) => g.name && g.name.toLowerCase().includes(s));
  }

  if (status && typeof status === 'string') {
    const statuses = status
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (statuses.length) {
      result = result.filter((g) => statuses.includes(g.status));
    }
  }

  if (method && typeof method === 'string') {
    const methods = method
      .split(',')
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean);
    if (methods.length) {
      result = result.filter((g) => methods.includes(g.selection_method));
    }
  }

  if (genres && typeof genres === 'string') {
    const reqGenres = genres
      .split(',')
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean);
    if (reqGenres.length) {
      result = result.filter(
        (g) =>
          Array.isArray(g.genres) &&
          g.genres.some((gen) => reqGenres.includes(gen.toLowerCase()))
      );
    }
  }

  if (yearMin || yearMax) {
    const min = yearMin ? parseInt(yearMin, 10) : null;
    const max = yearMax ? parseInt(yearMax, 10) : null;
    result = result.filter((g) => {
      if (typeof g.released_year !== 'number') return false;
      if (min !== null && g.released_year < min) return false;
      if (max !== null && g.released_year > max) return false;
      return true;
    });
  }

  if (ratingMin || ratingMax) {
    const min = ratingMin ? parseFloat(ratingMin) : null;
    const max = ratingMax ? parseFloat(ratingMax) : null;
    result = result.filter((g) => {
      if (typeof g.rating !== 'number') return false;
      if (min !== null && g.rating < min) return false;
      if (max !== null && g.rating > max) return false;
      return true;
    });
  }

  res.json({ games: result, availableGenres });
});

// Get details for a specific game with poll history
app.get('/api/games/:id', async (req, res) => {
  const gameId = parseInt(req.params.id, 10);
  if (Number.isNaN(gameId)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, name, status, rating, selection_method, background_image, released_year, genres')
    .eq('id', gameId)
    .maybeSingle();
  if (gameErr) return res.status(500).json({ error: gameErr.message });
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { data: initRows, error: initErr } = await supabase
    .from('game_initiators')
    .select('user_id')
    .eq('game_id', gameId);
  if (initErr) return res.status(500).json({ error: initErr.message });

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, username');
  if (usersErr) return res.status(500).json({ error: usersErr.message });

  const userMap = users.reduce((acc, u) => {
    acc[u.id] = u.username;
    return acc;
  }, {});

  const initiators = initRows
    .map((r) => ({ id: r.user_id, username: userMap[r.user_id] }))
    .filter((r) => r.username);

  const { data: pollGames, error: pgErr } = await supabase
    .from('poll_games')
    .select('poll_id')
    .eq('game_id', gameId);
  if (pgErr) return res.status(500).json({ error: pgErr.message });

  const pollIds = pollGames.map((pg) => pg.poll_id);

  const { data: polls, error: pollsErr } = await supabase
    .from('polls')
    .select('id, created_at, archived')
    .in('id', pollIds.length > 0 ? pollIds : [0]);
  if (pollsErr) return res.status(500).json({ error: pollsErr.message });

  const { data: pollResults, error: resultsErr } = await supabase
    .from('poll_results')
    .select('poll_id, winner_id')
    .in('poll_id', pollIds.length > 0 ? pollIds : [0]);
  if (resultsErr) return res.status(500).json({ error: resultsErr.message });

  const winnerIds = (pollResults || [])
    .map((r) => r.winner_id)
    .filter(Boolean);
  const { data: winnerGames, error: winnerErr } = await supabase
    .from('games')
    .select('id, name, background_image')
    .in('id', winnerIds.length > 0 ? winnerIds : [0]);
  if (winnerErr) return res.status(500).json({ error: winnerErr.message });

  const winnerMap = (winnerGames || []).reduce((acc, g) => {
    acc[g.id] = g;
    return acc;
  }, {});

  const resultMap = (pollResults || []).reduce((acc, r) => {
    acc[r.poll_id] = r.winner_id;
    return acc;
  }, {});

  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('poll_id, user_id')
    .eq('game_id', gameId);
  if (votesErr) return res.status(500).json({ error: votesErr.message });

  const voteMap = {};
  votes.forEach((v) => {
    if (!voteMap[v.poll_id]) voteMap[v.poll_id] = {};
    if (!voteMap[v.poll_id][v.user_id]) voteMap[v.poll_id][v.user_id] = 0;
    voteMap[v.poll_id][v.user_id] += 1;
  });

  const pollInfo = polls.map((p) => {
    const winnerId = resultMap[p.id];
    const winner = winnerId ? winnerMap[winnerId] : null;
    return {
      id: p.id,
      created_at: p.created_at,
      archived: p.archived,
      winnerId: winnerId || null,
      winnerName: winner ? winner.name : null,
      winnerBackground: winner ? winner.background_image : null,
      voters: Object.entries(voteMap[p.id] || {}).map(([uid, count]) => ({
        id: Number(uid),
        username: userMap[uid],
        count,
      })),
    };
  });

  // Fetch playlist for this game if associated
  let playlist = null;
  const { data: pgRow, error: pgError } = await supabase
    .from('playlist_games')
    .select('tag')
    .eq('game_id', gameId)
    .maybeSingle();
  if (pgError) return res.status(500).json({ error: pgError.message });

  if (pgRow && pgRow.tag) {
    const { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } = process.env;
    if (YOUTUBE_API_KEY && YOUTUBE_CHANNEL_ID) {
      try {
        const tagMap = await getPlaylists(
          YOUTUBE_API_KEY,
          YOUTUBE_CHANNEL_ID,
          [pgRow.tag]
        );
        const videos = tagMap[pgRow.tag];
        if (videos && videos.length) {
          playlist = { tag: pgRow.tag, videos };
        }
      } catch (err) {
        console.error('Failed to fetch playlist:', err);
      }
    }
  }

  res.json({
    game: {
      ...game,
      initiators,
      votes: votes.length,
      roulettes: pollGames.length,
    },
    polls: pollInfo,
    playlist,
  });
});

// Create or update a game entry with initiators (moderators only)
app.post('/api/manage_game', requireModerator, async (req, res) => {

  let {
    game_id,
    rawg_id,
    name,
    background_image,
    released_year,
    genres,
    status,
    selection_method,
    rating,
    initiators,
  } = req.body;

  if (!game_id && !name && !rawg_id) {
    return res.status(400).json({ error: 'game_id or name/rawg_id required' });
  }

  if (rawg_id) {
    const key = process.env.RAWG_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'RAWG_API_KEY not configured' });
    }
    try {
      const resp = await fetch(
        `https://api.rawg.io/api/games/${rawg_id}?key=${key}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (!name) name = data.name;
        if (!background_image) background_image = data.background_image;
        if (!released_year && data.released)
          released_year = new Date(data.released).getFullYear();
        if ((!genres || genres.length === 0) && Array.isArray(data.genres))
          genres = data.genres.map((g) => g.name);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  if (status && !['completed', 'backlog', 'active'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (
    selection_method &&
    !['donation', 'roulette', 'points'].includes(selection_method)
  ) {
    return res.status(400).json({ error: 'Invalid selection_method' });
  }

  let { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id')
    .eq('name', name)
    .limit(1)
    .maybeSingle();
  if (gameErr) return res.status(500).json({ error: gameErr.message });

  if (!game) {
    const { data: newGame, error: insErr } = await supabase
      .from('games')
      .insert({
        name,
        background_image,
        released_year: released_year || null,
        genres: genres && genres.length ? genres : null,
        status: status || 'backlog',
        selection_method: selection_method || null,
        rating: status === 'completed' && rating !== undefined ? rating : null,
      })
      .select('id')
      .single();
    if (insErr) return res.status(500).json({ error: insErr.message });
    game = newGame;
  } else {
    const updateFields = { name };
    if (background_image) updateFields.background_image = background_image;
    if (released_year) updateFields.released_year = released_year;
    if (genres && genres.length) updateFields.genres = genres;
    if (status) updateFields.status = status;
    if (selection_method) updateFields.selection_method = selection_method;
    if (status && status !== 'completed') {
      updateFields.rating = null;
    } else if (rating !== undefined) {
      updateFields.rating = rating;
    }
    const { error: upErr } = await supabase
      .from('games')
      .update(updateFields)
      .eq('id', game.id);
    if (upErr) return res.status(500).json({ error: upErr.message });
  }

  if (!Array.isArray(initiators)) initiators = [];
  const names = initiators.map((s) => String(s).trim()).filter((s) => s);

  const { data: currentInits, error: curErr } = await supabase
    .from('game_initiators')
    .select('user_id')
    .eq('game_id', game.id);
  if (curErr) return res.status(500).json({ error: curErr.message });
  const keepIds = [];

  for (const username of names) {
    let { data: u, error: uErr } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!u) {
      const { data: newU, error: insErr } = await supabase
        .from('users')
        .insert({ username })
        .select('id')
        .single();
      if (insErr) return res.status(500).json({ error: insErr.message });
      u = newU;
    }

    keepIds.push(u.id);
    const { error: giErr } = await supabase
      .from('game_initiators')
      .upsert({ game_id: game.id, user_id: u.id }, { onConflict: 'game_id,user_id' });
    if (giErr) return res.status(500).json({ error: giErr.message });
  }

  const removeIds = currentInits
    .map((i) => i.user_id)
    .filter((id) => !keepIds.includes(id));
  if (removeIds.length > 0) {
    const { error: delErr } = await supabase
      .from('game_initiators')
      .delete()
      .eq('game_id', game.id)
      .in('user_id', removeIds);
    if (delErr) return res.status(500).json({ error: delErr.message });
  }

  res.json({ game_id: game.id });
});

// Associate a YouTube playlist tag with a game (moderators only)
app.post('/api/playlist_game', requireModerator, async (req, res) => {
  const { tag, game_id, game_name, rawg_id, background_image } = req.body;
  if (!tag || typeof tag !== 'string') {
    return res.status(400).json({ error: 'tag is required' });
  }
  if (game_id !== undefined && game_id !== null && typeof game_id !== 'number') {
    return res
      .status(400)
      .json({ error: 'game_id must be a number or null' });
  }

  const actor =
    req.authUser?.user_metadata?.name ||
    req.authUser?.email ||
    req.authUser?.id;

  let game = null;
  if (game_id !== undefined) {
    if (game_id !== null) {
      const { data: g, error: gErr } = await supabase
        .from('games')
        .select('id, name')
        .eq('id', game_id)
        .maybeSingle();
      if (gErr) return res.status(500).json({ error: gErr.message });
      if (!g) return res.status(404).json({ error: 'Game not found' });
      game = g;
    }
  } else {
    if (!game_name && !rawg_id) {
      return res
        .status(400)
        .json({ error: 'game_name or rawg_id is required' });
    }

    let query = supabase.from('games').select('id, name');
    if (rawg_id) {
      query = query.eq('rawg_id', rawg_id);
    } else {
      query = query.ilike('name', game_name);
    }

    const { data: g, error: gErr } = await query.maybeSingle();
    if (gErr) return res.status(500).json({ error: gErr.message });

    if (g) {
      game = g;
    } else {
      if (!game_name) {
        return res
          .status(400)
          .json({ error: 'game_name is required to create game' });
      }
      const insertData = { name: game_name };
      if (background_image) insertData.background_image = background_image;
      if (rawg_id) insertData.rawg_id = rawg_id;
      const { data: newGame, error: insErr } = await supabase
        .from('games')
        .insert(insertData)
        .select('id, name')
        .single();
      if (insErr) return res.status(500).json({ error: insErr.message });
      game = newGame;
      logEvent(`New game ${game.name} created by ${actor}`);
    }
  }

  const { data, error } = await supabase
    .from('playlist_games')
    .upsert({ tag, game_id: game ? game.id : null }, { onConflict: 'tag' })
    .select('game_id')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  logEvent(
    `Playlist tag ${tag} set to ${game ? game.name : 'null'} by ${actor}`
  );

  res.json({ game_id: data.game_id });
});

// Store roulette result (moderators only)
app.post('/api/poll/:id/result', requireModerator, async (req, res) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) {
    return res.status(400).json({ error: 'Invalid poll id' });
  }


  const { winner_id, eliminated_order, spin_seed } = req.body;
  if (typeof winner_id !== 'number' || !Array.isArray(eliminated_order)) {
    return res.status(400).json({ error: 'winner_id and eliminated_order required' });
  }

  const { error } = await supabase
    .from('poll_results')
    .upsert({ poll_id: pollId, winner_id, eliminated_order, spin_seed }, { onConflict: 'poll_id' });
  if (error) return res.status(500).json({ error: error.message });
  const { data: g } = await supabase
    .from('games')
    .select('name')
    .eq('id', winner_id)
    .maybeSingle();
  logEvent(`Winner determined: ${g ? g.name : winner_id}`);
  res.json({ success: true });
});

// Fetch roulette result
app.get('/api/poll/:id/result', async (req, res) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) {
    return res.status(400).json({ error: 'Invalid poll id' });
  }
  const { data, error } = await supabase
    .from('poll_results')
    .select('*')
    .eq('poll_id', pollId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Result not found' });
  res.json(data);
});

// Reset roulette result (moderators only)
app.delete('/api/poll/:id/result', requireModerator, async (req, res) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) {
    return res.status(400).json({ error: 'Invalid poll id' });
  }


  const { error: delErr } = await supabase
    .from('poll_results')
    .delete()
    .eq('poll_id', pollId);
  if (delErr) return res.status(500).json({ error: delErr.message });
  res.json({ success: true });
});

// Fetch playlists grouped by tags from YouTube
app.get('/api/playlists', async (_req, res) => {
  const { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } = process.env;
  if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) {
    return res.status(500).json({ error: 'YouTube API not configured' });
  }
  try {
    const tagMap = await getPlaylists(YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID);

    const tags = Object.keys(tagMap);
    let tagGames = [];
    if (tags.length > 0) {
      const { data: tgRows, error: tgErr } = await supabase
        .from('playlist_games')
        .select('tag, game_id')
        .in('tag', tags);
      if (tgErr) return res.status(500).json({ error: tgErr.message });
      tagGames = tgRows || [];
    }

    const gameIds = tagGames.map((r) => r.game_id).filter((id) => id);
    let games = [];
    if (gameIds.length > 0) {
      const { data: gRows, error: gErr } = await supabase
        .from('games')
        .select('id, name, background_image')
        .in('id', gameIds);
      if (gErr) return res.status(500).json({ error: gErr.message });
      games = gRows || [];
    }

    const gameMap = games.reduce((acc, g) => {
      acc[g.id] = g;
      return acc;
    }, {});

    const tagToGame = tagGames.reduce((acc, r) => {
      acc[r.tag] = r.game_id ? gameMap[r.game_id] || null : null;
      return acc;
    }, {});

    const result = {};
    for (const [tag, videos] of Object.entries(tagMap)) {
      result[tag] = { videos, game: tagToGame[tag] || null };
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
});

app.get('/api/obs-media', requireModerator, async (req, res) => {
  const { type, grouped } = req.query;
  const types = await getObsTypes();
  let query = supabase.from('obs_media').select('id, type, gif_url, sound_url');
  if (type) {
    if (!(await isValidUserColumn(type)) || !types.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    query = query.eq('type', type);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  if (grouped === 'true') {
    const groupedResult = types.reduce((acc, t) => {
      acc[t] = [];
      return acc;
    }, {});
    for (const row of data || []) {
      if (groupedResult[row.type]) groupedResult[row.type].push(row);
    }
    return res.json({ media: groupedResult, types });
  }
  res.json({ media: data, types });
});

app.post('/api/obs-media', requireModerator, async (req, res) => {
  const { type, gif_url, sound_url } = req.body;
  if (!(await isValidUserColumn(type))) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  const { data, error } = await supabase
    .from('obs_media')
    .insert({ type, gif_url, sound_url })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ media: data });
});

app.put('/api/obs-media/:id', requireModerator, async (req, res) => {
  const { id } = req.params;
  const { type, gif_url, sound_url } = req.body;
  if (type && !(await isValidUserColumn(type))) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  const { data, error } = await supabase
    .from('obs_media')
    .update({ ...(type ? { type } : {}), gif_url, sound_url })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ media: data });
});

app.delete('/api/obs-media/:id', requireModerator, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('obs_media')
    .delete()
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// SSE endpoint for OBS events
app.get('/api/obs-events', (req, res) => {
  ensureObsChannel();
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  obsClients.add(res);
  req.on('close', () => {
    obsClients.delete(res);
  });
});

// Fetch recent event logs
app.get('/api/logs', async (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
    return res.status(400).json({ error: 'Invalid limit' });
  }
  const { type } = req.query;
  if (type && !['intim', 'poceluy'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  let query = supabase
    .from('event_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (type) {
    query = query.eq('type', type);
  }
  query = query.limit(limit);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ logs: data });
});

app.get('/api/achievements/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    const ids = (data || []).map((r) => r.achievement_id);
    if (ids.length === 0) return res.json({ achievements: [] });
    const { data: achData, error: achErr } = await supabase
      .from('achievements')
      .select('id, stat_key, title, description, threshold')
      .in('id', ids);
    if (achErr) return res.status(500).json({ error: achErr.message });
    const map = (achData || []).reduce((acc, a) => {
      acc[a.id] = a;
      return acc;
    }, {});
    const achievements = (data || [])
      .map((ua) => {
        const ach = map[ua.achievement_id];
        return ach ? { ...ach, earned_at: ua.earned_at } : null;
      })
      .filter(Boolean);
    res.json({ achievements });
  } catch (err) {
    console.error('Achievements fetch failed', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

app.get('/api/medals/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  try {
    const allColumns = [...INTIM_COLUMNS, ...POCELUY_COLUMNS, ...TOTAL_COLUMNS];
    const stats = await getTopByColumns(allColumns, 3);
    const medals = {};
    for (const col of allColumns) {
      medals[col] = medalFromList(stats[col], userId);
    }
    const topVoters = await getTopVoters(3);
    medals.top_voters = medalFromList(topVoters, userId);
    const topRouletteUsers = await getTopRouletteUsers(3);
    medals.top_roulette_users = medalFromList(topRouletteUsers, userId);
    res.json({ medals });
  } catch (err) {
    console.error('Medals fetch failed', err);
    res.status(500).json({ error: 'Failed to fetch medals' });
  }
});

app.get('/api/stats/intim', async (_req, res) => {
  try {
    const stats = await getTopByColumns(INTIM_COLUMNS, 5);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/poceluy', async (_req, res) => {
  try {
    const stats = await getTopByColumns(POCELUY_COLUMNS, 5);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/totals', async (_req, res) => {
  try {
    const stats = await getTopByColumns(TOTAL_COLUMNS, 5);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aggregate vote counts by game
app.get('/api/stats/popular-games', async (_req, res) => {
  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('game_id');
  if (votesErr) return res.status(500).json({ error: votesErr.message });

  const counts = votes.reduce((acc, v) => {
    acc[v.game_id] = (acc[v.game_id] || 0) + 1;
    return acc;
  }, {});
  const ids = Object.keys(counts).map((id) => parseInt(id, 10));
  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id, name')
    .in('id', ids.length > 0 ? ids : [0]);
  if (gamesErr) return res.status(500).json({ error: gamesErr.message });

  const result = games
    .map((g) => ({ id: g.id, name: g.name, votes: counts[g.id] || 0 }))
    .sort((a, b) => b.votes - a.votes);
  res.json({ games: result });
});

// Aggregate roulette counts by game
app.get('/api/stats/game-roulettes', async (_req, res) => {
  const { data: pollGames, error: pgErr } = await supabase
    .from('poll_games')
    .select('game_id');
  if (pgErr) return res.status(500).json({ error: pgErr.message });

  const counts = pollGames.reduce((acc, r) => {
    acc[r.game_id] = (acc[r.game_id] || 0) + 1;
    return acc;
  }, {});
  const ids = Object.keys(counts).map((id) => parseInt(id, 10));
  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id, name')
    .in('id', ids.length > 0 ? ids : [0]);
  if (gamesErr) return res.status(500).json({ error: gamesErr.message });

  const result = games
    .map((g) => ({ id: g.id, name: g.name, roulettes: counts[g.id] || 0 }))
    .sort((a, b) => b.roulettes - a.roulettes);
  res.json({ games: result });
});

// Aggregate vote counts by user
app.get('/api/stats/top-voters', async (_req, res) => {
  try {
    const users = await getTopVoters(1000);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aggregate distinct roulette counts by user
app.get('/api/stats/top-roulette-users', async (_req, res) => {
  try {
    const users = await getTopRouletteUsers(1000);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
app.INTIM_COLUMNS = INTIM_COLUMNS;
app.POCELUY_COLUMNS = POCELUY_COLUMNS;
app.TOTAL_COLUMNS = TOTAL_COLUMNS;
module.exports = app;
