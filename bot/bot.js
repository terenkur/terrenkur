const tmi = require('tmi.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  BOT_USERNAME,
  BOT_OAUTH_TOKEN,
  TWITCH_CHANNEL,
  TWITCH_CLIENT_ID,
  TWITCH_SECRET,
  TWITCH_CHANNEL_ID,
  LOG_REWARD_IDS,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}
if (!BOT_USERNAME || !BOT_OAUTH_TOKEN || !TWITCH_CHANNEL) {
  console.error('Missing Twitch bot configuration');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = new tmi.Client({
  identity: { username: BOT_USERNAME, password: BOT_OAUTH_TOKEN },
  channels: [TWITCH_CHANNEL],
});

let rewardIds = LOG_REWARD_IDS
  ? LOG_REWARD_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

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

async function logEvent(message) {
  try {
    await supabase.from('event_logs').insert({ message });
  } catch (err) {
    console.error('Failed to log event', err);
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
      let msg = `Donation from ${name}: ${amount}`;
      if (d.media && d.media.url) {
        msg += ` ${d.media.url}`;
      }
      await logEvent(msg);
    }
  } catch (err) {
    console.error('Donation check failed', err);
  }
}

checkDonations();
setInterval(checkDonations, 10000);

client.connect();

function parseCommand(message) {
  const trimmed = message.trim();
  const prefix = trimmed.startsWith('!игра')
    ? '!игра'
    : trimmed.startsWith('!game')
    ? '!game'
    : null;
  if (!prefix) return null;
  const gameName = trimmed.slice(prefix.length).trim();
  return { prefix, gameName };
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
  return data.map((pg) => pg.games);
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
  if (error) throw error;

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
  if (insertError) throw insertError;
  return { success: true };
}

client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  const rewardId = tags['custom-reward-id'];
  if (rewardId && (rewardIds.length === 0 || rewardIds.includes(rewardId))) {
    const text = message.trim();
    await logEvent(
      `Reward ${rewardId} redeemed by ${tags['display-name'] || tags.username}` +
        (text ? `: ${text}` : '')
    );
  }

  const parsed = parseCommand(message);
  if (!parsed) return;
  const { gameName } = parsed;
  if (!gameName) {
    client.say(channel, `@${tags.username}, укажите название игры.`);
    return;
  }

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

    const user = await findOrCreateUser(tags);
    const result = await addVote(user, poll.id, game.id);
    if (result.success) {
      client.say(channel, `@${tags.username}, голос за "${game.name}" засчитан!`);
    } else {
      client.say(channel, `@${tags.username}, лимит голосов исчерпан.`);
    }
  } catch (err) {
    console.error(err);
    client.say(channel, `@${tags.username}, произошла ошибка при обработке голоса.`);
  }
});

client.on('subscription', async (_channel, username, _methods, msg) => {
  await logEvent(`New sub: ${username}` + (msg ? ` - ${msg}` : ''));
});

client.on('subgift', async (_channel, username, _streakMonths, recipient) => {
  await logEvent(`Gift sub: ${username} -> ${recipient}`);
});

module.exports = { parseCommand, addVote, checkDonations, findOrCreateUser };

