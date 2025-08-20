const tmi = require('tmi.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  BOT_USERNAME,
  TWITCH_CHANNEL,
  TWITCH_CLIENT_ID,
  TWITCH_SECRET,
  TWITCH_CHANNEL_ID,
  LOG_REWARD_IDS,
  MUSIC_REWARD_ID,
  BOT_TOKEN,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}
if (!BOT_USERNAME || !TWITCH_CHANNEL) {
  console.error('Missing Twitch bot configuration');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = new tmi.Client({
  identity: { username: BOT_USERNAME, password: 'oauth:placeholder' },
  channels: [TWITCH_CHANNEL],
});

let rewardIds = LOG_REWARD_IDS
  ? LOG_REWARD_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

if (!MUSIC_REWARD_ID) {
  console.warn('MUSIC_REWARD_ID not set');
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

const ACHIEVEMENT_THRESHOLDS = {
  total_streams_watched: [10],
  total_subs_gifted: [5],
  total_subs_received: [5],
  total_chat_messages_sent: [500, 1000, 2000],
  total_times_tagged: [10],
  total_commands_run: [20],
  total_months_subbed: [3],
  total_watch_time: [60, 120, 240, 600, 1800, 3000],
  message_count: [20, 50, 100],
  first_message: [1],
  clips_created: [1],
  combo_commands: [1],
};

for (const col of [...INTIM_COLUMNS, ...POCELUY_COLUMNS]) {
  ACHIEVEMENT_THRESHOLDS[col] = [5];
}

const lastCommandTimes = new Map();

async function checkAndAwardAchievements(userId, field, value) {
  const thresholds = ACHIEVEMENT_THRESHOLDS[field] || [];
  let unlocked = false;
  for (const threshold of thresholds) {
    if (value < threshold) continue;
    const { data: achievement, error: achError } = await supabase
      .from('achievements')
      .select('id')
      .eq('stat_key', field)
      .eq('threshold', threshold)
      .maybeSingle();
    if (achError || !achievement) continue;
    const { data: existing, error: existError } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .eq('achievement_id', achievement.id)
      .maybeSingle();
    if (!existError && !existing) {
      const { error: insertError } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievement.id,
          earned_at: new Date().toISOString(),
        });
      if (!insertError) {
        unlocked = true;
      }
    }
  }
  return unlocked;
}

async function loadRewardIds() {
  try {
    const { data, error } = await supabase
      .from('log_rewards')
      .select('reward_id');
    if (error) throw error;
    const ids = (data || []).map((r) => r.reward_id).filter(Boolean);
    if (ids.length > 0 || rewardIds.length > 0) {
      rewardIds = Array.from(new Set([...rewardIds, ...ids]));
    }
  } catch (err) {
    console.error('Failed to load reward IDs', err);
  }
}

let botToken = null;
let botExpiry = 0;

async function getBotToken() {
  const now = Math.floor(Date.now() / 1000);
  if (botToken && botExpiry - 60 > now) {
    return botToken;
  }
  if (BOT_TOKEN) {
    botToken = BOT_TOKEN;
    botExpiry = Number.MAX_SAFE_INTEGER;
    return botToken;
  }
  try {
    const { data, error } = await supabase
      .from('bot_tokens')
      .select('access_token, expires_at')
      .maybeSingle();
    if (!error && data && data.access_token) {
      botToken = data.access_token;
      botExpiry = data.expires_at
        ? Math.floor(new Date(data.expires_at).getTime() / 1000)
        : 0;
      if (botExpiry - 60 > now) return botToken;
    } else {
      botToken = null;
      botExpiry = 0;
    }
  } catch (err) {
    console.error('Failed to load bot token', err);
  }
  return null;
}

let twitchToken = null;
let twitchExpiry = 0;

async function getTwitchToken() {
  if (twitchToken && twitchExpiry - 60 > Math.floor(Date.now() / 1000)) {
    return twitchToken;
  }
  if (!TWITCH_CLIENT_ID || !TWITCH_SECRET) {
    throw new Error('Twitch credentials not configured');
  }
  const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_SECRET}&grant_type=client_credentials`;
  const resp = await fetch(url, { method: 'POST' });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Auth failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  twitchToken = data.access_token;
  twitchExpiry = Math.floor(Date.now() / 1000) + (data.expires_in || 0);
  return twitchToken;
}

let donationToken = null;
let donationExpiry = 0;

async function getDonationAlertsToken() {
  if (donationToken && donationExpiry - 60 > Math.floor(Date.now() / 1000)) {
    return donationToken;
  }
  const { data, error } = await supabase
    .from('donationalerts_tokens')
    .select('access_token, expires_at')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.access_token) {
    throw error || new Error('Donation Alerts token not found');
  }
  donationToken = data.access_token;
  donationExpiry = data.expires_at
    ? Math.floor(new Date(data.expires_at).getTime() / 1000)
    : 0;
  return donationToken;
}

let streamerToken = null;
let streamerExpiry = 0;

async function getStreamerToken() {
  const now = Math.floor(Date.now() / 1000);
  if (streamerToken && streamerExpiry - 60 > now) {
    return streamerToken;
  }
  try {
    const { data, error } = await supabase
      .from('twitch_tokens')
      .select('access_token, expires_at')
      .maybeSingle();
    if (!error && data && data.access_token) {
      streamerToken = data.access_token;
      streamerExpiry = data.expires_at
        ? Math.floor(new Date(data.expires_at).getTime() / 1000)
        : 0;
      if (streamerExpiry === 0 || streamerExpiry - 60 > now) {
        return streamerToken;
      }
    }
  } catch (err) {
    console.error('Failed to load streamer token', err);
  }
  return null;
}

async function fetchRewardName(rewardId) {
  if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID) return null;
  try {
    const token = await getStreamerToken();
    if (!token) return null;
    const url = new URL(
      'https://api.twitch.tv/helix/channel_points/custom_rewards'
    );
    url.searchParams.set('broadcaster_id', TWITCH_CHANNEL_ID);
    url.searchParams.set('id', rewardId);
    const resp = await fetch(url.toString(), {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const reward = Array.isArray(data.data) ? data.data[0] : null;
    return reward?.title || null;
  } catch (err) {
    console.error('Failed to fetch reward name', err);
    return null;
  }
}

async function logEvent(
  message,
  mediaUrl = null,
  previewUrl = null,
  title = null,
  type = null
) {
  try {
    await supabase.from('event_logs').insert({
      message,
      media_url: mediaUrl,
      preview_url: previewUrl,
      title,
      type,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log event', err);
  }
}

async function fetchYoutubeTitle(url) {
  try {
    const oembed = new URL('https://www.youtube.com/oembed');
    oembed.searchParams.set('format', 'json');
    oembed.searchParams.set('url', url);
    const resp = await fetch(oembed.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.title || null;
  } catch (err) {
    console.error('Failed to fetch YouTube title', err);
    return null;
  }
}

function getYoutubeThumbnail(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.split('/')[1];
    } else if (u.hostname.includes('youtube.com')) {
      id = u.searchParams.get('v');
    }
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function isYoutubeUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'youtu.be' || u.hostname.endsWith('youtube.com');
  } catch {
    return false;
  }
}

async function checkNewFollower() {
  if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID || !TWITCH_SECRET) return;
  try {
    const token = await getTwitchToken();
    const url = new URL('https://api.twitch.tv/helix/users/follows');
    url.searchParams.set('to_id', TWITCH_CHANNEL_ID);
    url.searchParams.set('first', '1');
    const resp = await fetch(url.toString(), {
      headers: { 'Client-ID': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const follow = data.data && data.data[0];
    if (follow && follow.from_id !== checkNewFollower.lastId) {
      checkNewFollower.lastId = follow.from_id;
      await logEvent(`New follow: ${follow.from_name}`);
    }
  } catch (err) {
    console.error('Follower check failed', err);
  }
}

if (TWITCH_CHANNEL_ID && TWITCH_CLIENT_ID && TWITCH_SECRET) {
  setInterval(checkNewFollower, 60000);
}

loadRewardIds();
setInterval(loadRewardIds, 60000);

let lastDonationId = 0;
async function checkDonations() {
  try {
    const token = await getDonationAlertsToken();
    if (!token) return;
    const resp = await fetch(
      'https://www.donationalerts.com/api/v1/alerts/donations',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return;
    const data = await resp.json();
    const donations = Array.isArray(data?.data) ? data.data : [];
    for (const d of donations) {
      if (d.id <= lastDonationId) continue;
      lastDonationId = d.id;
      const name = d.username || d.name || 'Anonymous';
      const amount = `${d.amount}${d.currency ? ' ' + d.currency : ''}`;
      const msg = `Donation from ${name}: ${amount}`;
      const mediaUrl = d.media?.url || null;
      let previewUrl = null;
      if (mediaUrl && (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))) {
        previewUrl = getYoutubeThumbnail(mediaUrl);
      }
      await logEvent(msg, mediaUrl, previewUrl);
    }
  } catch (err) {
    console.error('Donation check failed', err);
  }
}

checkDonations();
setInterval(checkDonations, 10000);

const joinedThisStream = new Set();
let streamOnline = false;
let firstMessageAchieved = false;
let firstMessageUserId = null;

async function checkStreamStatus() {
  if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID || !TWITCH_SECRET) return;
  try {
    const token = await getTwitchToken();
    const url = new URL('https://api.twitch.tv/helix/streams');
    url.searchParams.set('user_id', TWITCH_CHANNEL_ID);
    const resp = await fetch(url.toString(), {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const online = Array.isArray(data.data) && data.data.length > 0;
    if (streamOnline && !online) {
      joinedThisStream.clear();
      firstMessageAchieved = false;
      firstMessageUserId = null;
      await supabase.from('stream_chatters').delete().neq('user_id', 0);
    } else if (!streamOnline && online) {
      joinedThisStream.clear();
      firstMessageAchieved = false;
      firstMessageUserId = null;
      await supabase.from('stream_chatters').delete().neq('user_id', 0);
    }
    streamOnline = online;
  } catch (err) {
    console.error('Stream status check failed', err);
  }
}

checkStreamStatus();
setInterval(checkStreamStatus, 60000);

async function incrementWatchTime() {
  try {
    const { data, error } = await supabase
      .from('stream_chatters')
      .select('user_id');
    if (error) throw error;
    const chatters = data || [];
    await Promise.all(
      chatters.map((c) => incrementUserStat(c.user_id, 'total_watch_time'))
    );
  } catch (err) {
    console.error('watch time update failed', err);
  }
}

setInterval(incrementWatchTime, 60 * 1000);

let warnedNoBotToken = false;
async function connectClient() {
  try {
    const token = await getBotToken();
    if (!token) {
      if (!warnedNoBotToken) {
        console.warn('No bot token found; skipping bot connection');
        warnedNoBotToken = true;
      }
      return;
    }
    warnedNoBotToken = false;
    client.opts.identity.password = `oauth:${token}`;
    await client.connect();
  } catch (err) {
    console.error('Failed to connect bot', err);
  }
}

connectClient();

if (TWITCH_CHANNEL) {
  updateSubMonths(TWITCH_CHANNEL).catch((err) =>
    console.error('Initial sub check failed', err)
  );
}

setInterval(async () => {
  const now = Math.floor(Date.now() / 1000);
  if (!botToken || botExpiry - 60 <= now) {
    try {
      if (typeof client.disconnect === 'function') {
        try {
          if (typeof client.readyState === 'function' && client.readyState() === 'OPEN') {
            await client.disconnect();
          }
        } catch {}
      }
      await connectClient();
    } catch (err) {
      console.error('Bot reconnection failed', err);
    }
  }
}, 60 * 1000);

client.on('disconnected', (reason) => {
  if (reason === 'Login authentication failed') {
    setTimeout(() => {
      connectClient();
    }, 1000);
  }
});

function parseCommand(message) {
  const original = message.trim();
  const lowered = original.toLowerCase();
  const prefix = lowered.startsWith('!игра')
    ? '!игра'
    : lowered.startsWith('!game')
    ? '!game'
    : null;
  if (!prefix) return null;
  const rest = original.slice(prefix.length).trim();
  const args = rest ? rest.split(/\s+/) : [];
  return { prefix, args };
}

async function getActivePoll() {
  const { data: poll, error } = await supabase
    .from('polls')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return poll;
}

async function getGamesForPoll(pollId) {
  const { data, error } = await supabase
    .from('poll_games')
    .select('game_id, games ( id, name )')
    .eq('poll_id', pollId);
  if (error) throw error;

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('game_id')
    .eq('poll_id', pollId);
  if (votesError) throw votesError;

  const counts = (votes || []).reduce((acc, v) => {
    acc[v.game_id] = (acc[v.game_id] || 0) + 1;
    return acc;
  }, {});

  return data.map((pg) => ({
    ...pg.games,
    votes: counts[pg.game_id] || 0,
  }));
}

async function findOrCreateUser(tags) {
  const login = (tags.username || '').toLowerCase();
  let { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('twitch_login', login)
    .maybeSingle();
  if (error) throw error;
  if (!user) {
    const display = tags['display-name'] || tags.username;
    const res = await supabase
      .from('users')
      .insert({ username: display, twitch_login: login })
      .select()
      .single();
    if (res.error) throw res.error;
    user = res.data;
  }
  return user;
}

async function incrementUserStat(userId, field, amount = 1) {
  let unlocked = false;
  try {
    const { data, error } = await supabase
      .from('users')
      .select(field)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const current = (data && data[field]) || 0;
    const newValue = current + amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ [field]: newValue })
      .eq('id', userId);
    if (updateError) throw updateError;

    unlocked = await checkAndAwardAchievements(userId, field, newValue);
  } catch (error) {
    console.error(`Failed to increment ${field} for user ${userId}`, error);
  }
  return unlocked;
}

async function isVotingEnabled() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'accept_votes')
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch accept_votes', error);
    return true;
  }
  return !data || Number(data.value) !== 0;
}

async function addVote(user, pollId, gameId) {
  const { data: votes, error } = await supabase
    .from('votes')
    .select('slot')
    .eq('poll_id', pollId)
    .eq('user_id', user.id);
  if (error) {
    console.error('Failed to fetch votes', error);
    return { success: false, reason: 'db error' };
  }

  const limit = user.vote_limit || 1;
  if (votes.length >= limit) {
    return { success: false, reason: 'vote limit reached' };
  }

  const used = votes.map((v) => v.slot);
  let slot = null;
  for (let i = 1; i <= limit; i++) {
    if (!used.includes(i)) {
      slot = i;
      break;
    }
  }
  if (!slot) {
    return { success: false, reason: 'vote limit reached' };
  }

  const { error: insertError } = await supabase.from('votes').insert({
    poll_id: pollId,
    game_id: gameId,
    user_id: user.id,
    slot,
  });
  if (insertError) {
    console.error('Failed to insert vote', insertError);
    return { success: false, reason: 'db error' };
  }
  return { success: true };
}

async function updateSubMonths(username, tags = {}) {
  try {
    if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID) return;
    let userId = tags['user-id'];
    if (!userId) {
      try {
        const appToken = await getTwitchToken();
        const resp = await fetch(
          `https://api.twitch.tv/helix/users?login=${encodeURIComponent(
            username
          )}`,
          {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              Authorization: `Bearer ${appToken}`,
            },
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          userId = data.data?.[0]?.id;
        }
      } catch {
        return;
      }
    }
    if (!userId) return;
    const token = await getStreamerToken();
    if (!token) return;
    const url = new URL('https://api.twitch.tv/helix/subscriptions');
    url.searchParams.set('broadcaster_id', TWITCH_CHANNEL_ID);
    url.searchParams.set('user_id', userId);
    const resp = await fetch(url.toString(), {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const months = data.data?.[0]?.cumulative_months;
    if (!months) return;
    const user = await findOrCreateUser({ ...tags, username });
    if ((user.total_months_subbed || 0) < months) {
      const { error } = await supabase
        .from('users')
        .update({ total_months_subbed: months })
        .eq('id', user.id);
      if (error) {
        console.error('Failed to update sub months', error);
      }
    }
  } catch (err) {
    console.error('updateSubMonths failed', err);
  }
}

client.on('join', async (_channel, username, self) => {
  if (self) return;
  try {
    const user = await findOrCreateUser({ username });
    await updateSubMonths(username);
    if (!joinedThisStream.has(user.id)) {
      joinedThisStream.add(user.id);
      await incrementUserStat(user.id, 'total_streams_watched');
    }
  } catch (err) {
    console.error('join handler failed', err);
  }
});

client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  let user;
  try {
    user = await findOrCreateUser(tags);
    if (!firstMessageAchieved) {
      try {
        await checkAndAwardAchievements(user.id, 'first_message', 1);
      } catch (err) {
        console.error('first message achievement failed', err);
      }
      firstMessageAchieved = true;
      firstMessageUserId = user.id;
    }
    if (tags.username.toLowerCase() !== 'hornypaps') {
      let messageCount = 0;
      try {
        const { data: chatter } = await supabase
          .from('stream_chatters')
          .select('message_count')
          .eq('user_id', user.id)
          .maybeSingle();
        messageCount = (chatter?.message_count || 0) + 1;
        await supabase
          .from('stream_chatters')
          .upsert(
            { user_id: user.id, message_count: messageCount },
            { onConflict: 'user_id' }
          );
        await checkAndAwardAchievements(
          user.id,
          'message_count',
          messageCount
        );
      } catch (err) {
        console.error('stream chatter update failed', err);
      }
    }
    await incrementUserStat(user.id, 'total_chat_messages_sent');
    if (message.trim().startsWith('!')) {
      await incrementUserStat(user.id, 'total_commands_run');
    }
    const mentions = Array.from(message.matchAll(/@([A-Za-z0-9_]+)/g));
    await Promise.all(
      mentions.map(async (m) => {
        const login = m[1].toLowerCase();
        const { data: mentioned } = await supabase
          .from('users')
          .select('id')
          .eq('twitch_login', login)
          .maybeSingle();
        if (mentioned) {
          await incrementUserStat(mentioned.id, 'total_times_tagged');
        }
      })
    );
  } catch (err) {
    console.error('message stat update failed', err);
  }

  const loweredMsg = message.trim().toLowerCase();
  if (loweredMsg === '!clip') {
    try {
      if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID) {
        client.say(channel, `@${tags.username}, не удалось создать клип.`);
        return;
      }
      const token = await getStreamerToken();
      if (!token) {
        client.say(channel, `@${tags.username}, не удалось создать клип.`);
        return;
      }
      const url = new URL('https://api.twitch.tv/helix/clips');
      url.searchParams.set('broadcaster_id', TWITCH_CHANNEL_ID);
      const resp = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) {
        client.say(channel, `@${tags.username}, не удалось создать клип.`);
        return;
      }
      const data = await resp.json();
      const clipId = data?.data?.[0]?.id;
      if (clipId) {
        client.say(
          channel,
          `@${tags.username}, клип создан: https://clips.twitch.tv/${clipId}`
        );
        await incrementUserStat(user.id, 'clips_created');
      } else {
        client.say(channel, `@${tags.username}, не удалось создать клип.`);
      }
    } catch (err) {
      console.error('clip creation failed', err);
      client.say(channel, `@${tags.username}, не удалось создать клип.`);
    }
    return;
  }
  if (loweredMsg.startsWith('!интим')) {
    const args = message.trim().split(/\s+/).slice(1);
    const tagArg = args.find((a) => a.startsWith('@'));
    let partnerUser = null;
    let taggedUser = null;

    const now = Date.now();
    const entry = lastCommandTimes.get(user.id) || { intim: 0, poceluy: 0 };
    if (now - entry.poceluy <= 60000) {
      await incrementUserStat(user.id, 'combo_commands');
    }
    entry.intim = now;
    lastCommandTimes.set(user.id, entry);

    try {
      const { data: chatters, error } = await supabase
        .from('stream_chatters')
        .select('user_id, users ( username )');
      if (error) throw error;
      if (!chatters || chatters.length === 0) {
        client.say(channel, `@${tags.username}, сейчас нет других участников.`);
        return;
      }
      const random = chatters[Math.floor(Math.random() * chatters.length)];
      partnerUser = { id: random.user_id, username: random.users.username };
    } catch (err) {
      console.error('select random chatter failed', err);
      return;
    }

    if (tagArg) {
      try {
        const login = tagArg.replace(/^@/, '').toLowerCase();
        const { data: tUser, error: tErr } = await supabase
          .from('users')
          .select('id, username')
          .eq('twitch_login', login)
          .maybeSingle();
        if (tErr) throw tErr;
        taggedUser = tUser;
      } catch (err) {
        console.error('fetch tagged user failed', err);
      }
    }

    try {
      const { data: contexts, error: ctxErr } = await supabase
        .from('intim_contexts')
        .select('variant_one, variant_two');
      if (ctxErr || !contexts || contexts.length === 0) throw ctxErr;
      const context =
        contexts[Math.floor(Math.random() * contexts.length)] || {};
      const variantOne = context.variant_one || '';
      const variantTwo = context.variant_two || '';
      const percent = Math.floor(Math.random() * 101);
      const hasTag = !!tagArg;
      const isSelf = partnerUser.id === user.id;
      const partnerMatchesTag =
        hasTag &&
        tagArg.replace(/^@/, '').toLowerCase() ===
          partnerUser.username.toLowerCase();
      const columnsBefore = [];
      if (isSelf) {
        columnsBefore.push(
          `intim_self_${hasTag ? 'with_tag' : 'no_tag'}`
        );
      }
      if (partnerMatchesTag) {
        columnsBefore.push('intim_tagged_equals_partner');
        columnsBefore.push('intim_tag_match_success');
        if (taggedUser) {
          await incrementUserStat(taggedUser.id, 'intim_tagged_equals_partner');
        }
      }
      if (columnsBefore.length) {
        await Promise.all(
          columnsBefore.map((col) => incrementUserStat(user.id, col))
        );
      }
      const percentSpecial = [0, 69, 100].includes(percent);
      const authorName = `@${tags.username}`;
      const partnerName = isSelf ? 'самим собой' : `@${partnerUser.username}`;
      if (percentSpecial) {
        const columns = [];
        const suffix = String(percent);
        const tagType = hasTag ? 'with_tag' : 'no_tag';
        columns.push(`intim_${tagType}_${suffix}`);
        if (isSelf) {
          columns.push(`intim_self_${tagType}_${suffix}`);
        }
        if (partnerMatchesTag) {
          columns.push(`intim_tagged_equals_partner_${suffix}`);
          columns.push(`intim_tag_match_success_${suffix}`);
          if (taggedUser) {
            await incrementUserStat(
              taggedUser.id,
              `intim_tagged_equals_partner_${suffix}`
            );
          }
        }
        await Promise.all(
          columns.map((col) => incrementUserStat(user.id, col))
        );
      }
      const text = hasTag
        ? `${percent}% шанс того, что ${authorName} ${variantTwo} ${tagArg} интимиться с ${partnerName} ${variantOne}`
        : `${percent}% шанс того, что у ${authorName} ${variantOne} будет интим с ${partnerName}`;
      client.say(channel, text);
      await logEvent(text, null, null, null, 'intim');
    } catch (err) {
      console.error('intim command failed', err);
    }
    return;
  }

  if (loweredMsg.startsWith('!поцелуй')) {
    const args = message.trim().split(/\s+/).slice(1);
    const tagArg = args.find((a) => a.startsWith('@'));
    let partnerUser = null;
    let taggedUser = null;

    const now = Date.now();
    const entry = lastCommandTimes.get(user.id) || { intim: 0, poceluy: 0 };
    if (now - entry.intim <= 60000) {
      await incrementUserStat(user.id, 'combo_commands');
    }
    entry.poceluy = now;
    lastCommandTimes.set(user.id, entry);

    try {
      const { data: chatters, error } = await supabase
        .from('stream_chatters')
        .select('user_id, users ( username )');
      if (error) throw error;
      if (!chatters || chatters.length === 0) {
        client.say(channel, `@${tags.username}, сейчас нет других участников.`);
        return;
      }
      const random = chatters[Math.floor(Math.random() * chatters.length)];
      partnerUser = { id: random.user_id, username: random.users.username };
    } catch (err) {
      console.error('select random chatter failed', err);
      return;
    }

    if (tagArg) {
      try {
        const login = tagArg.replace(/^@/, '').toLowerCase();
        const { data: tUser, error: tErr } = await supabase
          .from('users')
          .select('id, username')
          .eq('twitch_login', login)
          .maybeSingle();
        if (tErr) throw tErr;
        taggedUser = tUser;
      } catch (err) {
        console.error('fetch tagged user failed', err);
      }
    }

    try {
      const { data: contexts, error: ctxErr } = await supabase
        .from('poceluy_contexts')
        .select('variant_two, variant_three');
      if (ctxErr || !contexts || contexts.length === 0) throw ctxErr;
      const context =
        contexts[Math.floor(Math.random() * contexts.length)] || {};
      const variantTwo = context.variant_two || '';
      const variantThree = context.variant_three || '';
      const percent = Math.floor(Math.random() * 101);
      const hasTag = !!tagArg;
      const isSelf = partnerUser.id === user.id;
      const partnerMatchesTag =
        hasTag &&
        tagArg.replace(/^@/, '').toLowerCase() ===
          partnerUser.username.toLowerCase();
      const columnsBefore = [];
      if (isSelf) {
        columnsBefore.push(
          `poceluy_self_${hasTag ? 'with_tag' : 'no_tag'}`
        );
      }
      if (partnerMatchesTag) {
        columnsBefore.push('poceluy_tagged_equals_partner');
        columnsBefore.push('poceluy_tag_match_success');
        if (taggedUser) {
          await incrementUserStat(taggedUser.id, 'poceluy_tagged_equals_partner');
        }
        }
      if (columnsBefore.length) {
        await Promise.all(
          columnsBefore.map((col) => incrementUserStat(user.id, col))
        );
      }
      const percentSpecial = [0, 69, 100].includes(percent);
      const authorName = `@${tags.username}`;
      const partnerName = isSelf ? 'самим собой' : `@${partnerUser.username}`;
      if (percentSpecial) {
        const columns = [];
        const suffix = String(percent);
        const tagType = hasTag ? 'with_tag' : 'no_tag';
        columns.push(`poceluy_${tagType}_${suffix}`);
        if (isSelf) {
          columns.push(`poceluy_self_${tagType}_${suffix}`);
        }
        if (partnerMatchesTag) {
          columns.push(`poceluy_tagged_equals_partner_${suffix}`);
          columns.push(`poceluy_tag_match_success_${suffix}`);
          if (taggedUser) {
            await incrementUserStat(
              taggedUser.id,
              `poceluy_tagged_equals_partner_${suffix}`
            );
          }
        }
        await Promise.all(
          columns.map((col) => incrementUserStat(user.id, col))
        );
      }
      const text = hasTag
        ? `${percent}% шанс того, что ${authorName} ${variantTwo} ${tagArg} поцеловать ${partnerName} ${variantThree}`
        : `${percent}% шанс того, что у ${authorName} ${variantThree} поцелует с ${partnerName}`;
      client.say(channel, text);
      await logEvent(text, null, null, null, 'poceluy');
    } catch (err) {
      console.error('poceluy command failed', err);
    }
    return;
  }

  const rewardId = tags['custom-reward-id'];
  if (MUSIC_REWARD_ID && rewardId === MUSIC_REWARD_ID) {
    const text = message.trim();
    if (!text) {
      console.warn(
        `Music reward redeemed without text by ${
          tags['display-name'] || tags.username
        }`
      );
      return;
    }
    if (!isYoutubeUrl(text)) {
      console.error('Invalid YouTube URL', text);
      client.say(channel, `@${tags.username}, invalid YouTube link.`);
      return;
    }
    const preview = getYoutubeThumbnail(text);
    const title = await fetchYoutubeTitle(text);
    const name = (await fetchRewardName(rewardId)) || rewardId;
    await logEvent(
      `Reward ${name} redeemed by ${tags['display-name'] || tags.username}: ${text}`,
      text,
      preview,
      title
    );
  } else if (rewardId && (rewardIds.length === 0 || rewardIds.includes(rewardId))) {
    const text = message.trim();
    const name = (await fetchRewardName(rewardId)) || rewardId;
    await logEvent(
      `Reward ${name} redeemed by ${tags['display-name'] || tags.username}` +
        (text ? `: ${text}` : '')
    );
  }

  const parsed = parseCommand(message);
  if (!parsed) return;
  const { args } = parsed;
  const [firstArg, ...restArgs] = args;
  if (!firstArg) {
    client.say(channel, `@${tags.username}, укажите название игры.`);
    return;
  }

  const sub = firstArg.toLowerCase();

  if (sub === 'список') {
    try {
      const poll = await getActivePoll();
      if (!poll) {
        client.say(channel, `@${tags.username}, сейчас нет активной рулетки.`);
        return;
      }
        const games = await getGamesForPoll(poll.id);
        const names = games
          .map((g) => `${g.name} - ${g.votes}`)
          .join(' | ');
        client.say(channel, names);
    } catch (err) {
      console.error(err);
      client.say(channel, `@${tags.username}, произошла ошибка при получении списка игр.`);
    }
    return;
  }

  if (sub === 'голоса') {
    try {
      const poll = await getActivePoll();
      if (!poll) {
        client.say(channel, `@${tags.username}, сейчас нет активной рулетки.`);
        return;
      }
      const { data: votes, error } = await supabase
        .from('votes')
        .select('game_id, games(name)')
        .eq('poll_id', poll.id)
        .eq('user_id', user.id);
      if (error) {
        throw error;
      }
      const remaining = (user.vote_limit || 1) - votes.length;
      const grouped = (votes || []).reduce((acc, v) => {
        if (!acc[v.game_id]) {
          acc[v.game_id] = { name: v.games?.name, count: 0 };
        }
        acc[v.game_id].count += 1;
        return acc;
      }, {});
      const counts = Object.values(grouped).reduce((obj, { name, count }) => {
        if (name) obj[name] = count;
        return obj;
      }, {});
      const details = Object.entries(counts)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ');
      let message = `@${tags.username}, у вас осталось ${remaining} голосов.`;
      if (details) {
        message += ` Вы проголосовали за: ${details}.`;
      }
      client.say(channel, message);
    } catch (err) {
      console.error(err);
      client.say(channel, `@${tags.username}, произошла ошибка при подсчёте голосов.`);
    }
    return;
  }

  const gameName = [firstArg, ...restArgs].join(' ');

  try {
    const poll = await getActivePoll();
    if (!poll) {
      client.say(channel, `@${tags.username}, сейчас нет активной рулетки.`);
      return;
    }

    const votingOpen = await isVotingEnabled();
    if (!votingOpen) {
      client.say(channel, `@${tags.username}, приём голосов закрыт.`);
      return;
    }

    const games = await getGamesForPoll(poll.id);
    const game = games.find((g) => g.name.toLowerCase() === gameName.toLowerCase());
    if (!game) {
      client.say(channel, `@${tags.username}, игра "${gameName}" не найдена в рулетке.`);
      return;
    }

    const result = await addVote(user, poll.id, game.id);
    if (result.success) {
      client.say(channel, `@${tags.username}, голос за "${game.name}" засчитан!`);
    } else if (result.reason === 'vote limit reached') {
      client.say(channel, `@${tags.username}, лимит голосов исчерпан.`);
    } else {
      client.say(
        channel,
        `@${tags.username}, не удалось обработать голос из-за технических проблем.`
      );
    }
  } catch (err) {
    console.error(err);
    client.say(channel, `@${tags.username}, произошла ошибка при обработке голоса.`);
  }
});

client.on('subscription', async (_channel, username, _methods, msg, tags) => {
  await logEvent(`New sub: ${username}` + (msg ? ` - ${msg}` : ''));
  await updateSubMonths(username, tags);
});

client.on('resub', async (_channel, username, _months, msg, tags) => {
  await logEvent(`Re-sub: ${username}` + (msg ? ` - ${msg}` : ''));
  await updateSubMonths(username, tags);
});

client.on('subgift', async (_channel, username, _streakMonths, recipient, _methods, tags) => {
  await logEvent(`Gift sub: ${username} -> ${recipient}`);
  try {
    const gifter = await findOrCreateUser({ ...tags, username });
    const receiver = await findOrCreateUser({ username: recipient });
    await incrementUserStat(gifter.id, 'total_subs_gifted');
    await incrementUserStat(receiver.id, 'total_subs_received');
  } catch (err) {
    console.error('subgift stat update failed', err);
  }
});

client.on('submysterygift', async (_channel, username, numberOfSubs, _methods, tags) => {
  try {
    const gifter = await findOrCreateUser({ ...tags, username });
    await incrementUserStat(gifter.id, 'total_subs_gifted', Number(numberOfSubs) || 0);
  } catch (err) {
    console.error('submysterygift stat update failed', err);
  }
});

module.exports = {
  parseCommand,
  addVote,
  checkDonations,
  findOrCreateUser,
  incrementUserStat,
  updateSubMonths,
};

