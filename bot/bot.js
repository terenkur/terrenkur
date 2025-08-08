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
  MUSIC_REWARD_ID,
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

if (!MUSIC_REWARD_ID) {
  console.warn('MUSIC_REWARD_ID not set');
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

async function logEvent(message, mediaUrl = null, previewUrl = null) {
  try {
    await supabase
      .from('event_logs')
      .insert({ message, media_url: mediaUrl, preview_url: previewUrl });
  } catch (err) {
    console.error('Failed to log event', err);
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
      await supabase.from('stream_chatters').delete().neq('user_id', 0);
    } else if (!streamOnline && online) {
      joinedThisStream.clear();
      await supabase.from('stream_chatters').delete().neq('user_id', 0);
    }
    streamOnline = online;
  } catch (err) {
    console.error('Stream status check failed', err);
  }
}

checkStreamStatus();
setInterval(checkStreamStatus, 60000);

client.connect();

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

async function incrementUserStat(userId, field, amount = 1) {
  const { error } = await supabase
    .from('users')
    .update({ [field]: supabase.increment(amount) })
    .eq('id', userId);
  if (error) {
    console.error(`Failed to increment ${field} for user ${userId}`, error);
  }
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

async function updateSubMonths(username, tags) {
  try {
    const months = Number(tags['msg-param-cumulative-months']);
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
    if (tags.username.toLowerCase() !== 'hornypaps') {
      await supabase
        .from('stream_chatters')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' });
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
  if (loweredMsg.startsWith('!интим')) {
    const args = message.trim().split(/\s+/).slice(1);
    const tagArg = args.find((a) => a.startsWith('@'));
    let partnerUser = null;
    let taggedUser = null;

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
    } catch (err) {
      console.error('intim command failed', err);
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
    await logEvent(
      `Reward ${rewardId} redeemed by ${tags['display-name'] || tags.username}: ${text}`,
      text,
      preview
    );
  } else if (rewardId && (rewardIds.length === 0 || rewardIds.includes(rewardId))) {
    const text = message.trim();
    await logEvent(
      `Reward ${rewardId} redeemed by ${tags['display-name'] || tags.username}` +
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
      const names = games.map((g) => g.name).join(' | ');
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
        .select('id')
        .eq('poll_id', poll.id)
        .eq('user_id', user.id);
      if (error) {
        throw error;
      }
      const remaining = (user.vote_limit || 1) - votes.length;
      client.say(channel, `@${tags.username}, у вас осталось ${remaining} голосов.`);
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
};

