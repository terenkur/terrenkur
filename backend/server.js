const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@supabase/supabase-js');
const { getPlaylists } = require('./youtube');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(express.json());

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
    const resp = await fetch(target.toString());
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

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function logEvent(message) {
  try {
    await supabase.from('event_logs').insert({ message });
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
    if (pgErr) return res.status(500).json({ error: pgErr.message });
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
        .update({ auth_id: authUser.id })
        .eq('id', existingUser.id)
        .select()
        .single();
      if (updateError) return res.status(500).json({ error: updateError.message });
      user = updated;
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ auth_id: authUser.id, username })
        .select()
        .single();
      if (insertError) return res.status(500).json({ error: insertError.message });
      user = newUser;
    }
  } else if (username && user.username !== username) {
    // Update username if it changed
    await supabase.from('users').update({ username }).eq('id', user.id);
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
  let builder = supabase
    .from('users')
    .select('id, username, auth_id');
  if (search) {
    builder = builder.ilike('username', `%${search}%`);
  }
  builder = builder.order('username', { ascending: true });
  const { data, error } = await builder;
  if (error) return res.status(500).json({ error: error.message });
  const users = (data || []).map((u) => ({
    id: u.id,
    username: u.username,
    auth_id: u.auth_id,
    logged_in: !!u.auth_id,
  }));
  res.json({ users });
});

// Get a user's vote history
app.get('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username, auth_id')
    .eq('id', userId)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('poll_id, game_id')
    .eq('user_id', userId);
  if (votesError) return res.status(500).json({ error: votesError.message });

  const pollIds = [...new Set(votes.map((v) => v.poll_id))];
  const gameIds = [...new Set(votes.map((v) => v.game_id))];

  const { data: polls, error: pollsError } = await supabase
    .from('polls')
    .select('id, created_at')
    .in('id', pollIds.length > 0 ? pollIds : [0]);
  if (pollsError) return res.status(500).json({ error: pollsError.message });

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
    acc[p.id] = { id: p.id, created_at: p.created_at, games: [] };
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

  let { poll_id, rawg_id, name, background_image, released_year, genres } =
    req.body;
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
app.get('/api/games', async (_req, res) => {
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
      'id, name, status, rating, selection_method, background_image, released_year, genres'
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

  const result = games.map((g) => ({
    id: g.id,
    name: g.name,
    background_image: g.background_image,
    released_year: g.released_year,
    genres: g.genres,
    status: activeSet.has(g.id) ? 'active' : g.status || 'backlog',
    rating: g.rating,
    selection_method: g.selection_method,
    initiators: initMap[g.id] || [],
  }));

  res.json({ games: result });
});

// Get details for a specific game with poll history
app.get('/api/games/:id', async (req, res) => {
  const gameId = parseInt(req.params.id, 10);
  if (Number.isNaN(gameId)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, name, status, rating, selection_method, background_image')
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

  const pollInfo = polls.map((p) => ({
    id: p.id,
    created_at: p.created_at,
    archived: p.archived,
    voters: Object.entries(voteMap[p.id] || {}).map(([uid, count]) => ({
      id: Number(uid),
      username: userMap[uid],
      count,
    })),
  }));

  res.json({
    game: { ...game, initiators },
    polls: pollInfo,
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
    const data = await getPlaylists(YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
});

// Fetch recent event logs
app.get('/api/logs', async (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
    return res.status(400).json({ error: 'Invalid limit' });
  }
  const { data, error } = await supabase
    .from('event_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ logs: data });
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
  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('user_id');
  if (votesErr) return res.status(500).json({ error: votesErr.message });

  const counts = votes.reduce((acc, v) => {
    acc[v.user_id] = (acc[v.user_id] || 0) + 1;
    return acc;
  }, {});
  const ids = Object.keys(counts).map((id) => parseInt(id, 10));
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, username')
    .in('id', ids.length > 0 ? ids : [0]);
  if (usersErr) return res.status(500).json({ error: usersErr.message });

  const result = users
    .map((u) => ({ id: u.id, username: u.username, votes: counts[u.id] || 0 }))
    .sort((a, b) => b.votes - a.votes);
  res.json({ users: result });
});

const port = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = app;
