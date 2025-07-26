const tmi = require('tmi.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  BOT_USERNAME,
  BOT_OAUTH_TOKEN,
  TWITCH_CHANNEL,
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

client.connect();

async function getActivePoll() {
  const { data: poll, error } = await supabase
    .from('polls')
    .select('*')
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

async function findOrCreateUser(username) {
  let { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  if (!user) {
    const res = await supabase
      .from('users')
      .insert({ username })
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

  const trimmed = message.trim();
  const prefix = trimmed.startsWith('!игра') ? '!игра' : trimmed.startsWith('!game') ? '!game' : null;
  if (!prefix) return;

  const gameName = trimmed.slice(prefix.length).trim();
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

    const user = await findOrCreateUser(tags['display-name'] || tags.username);
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

