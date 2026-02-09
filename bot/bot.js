const tmi = require('tmi.js');
const { createClient } = require('@supabase/supabase-js');
const obsClient = require('./obsClient');
const { createStreamerBotIntegration } = require('./streamerBotClient');
const streamerBotHandlers = require('./streamerBotHandlers');
const streamerBotChatActions = require('../shared/streamerBotChatActions');
const { aiConfig } = require('./config/ai');
const { createAiService } = require('./services/ai');
const {
  createUserService,
  createPollService,
  createTokenService,
  createLoggingService,
  createChatterService,
} = require('./services/db');
const { createMessageHandler } = require('./handlers/message');
const { createJoinHandler } = require('./handlers/join');
const { createSubscriptionHandler } = require('./handlers/subscription');
const { createResubHandler } = require('./handlers/resub');
const { createSubgiftHandler } = require('./handlers/subgift');
const { createSubmysterygiftHandler } = require('./handlers/submysterygift');
const { createBackgroundTasks } = require('./handlers/background');
const { parseCommand } = require('./handlers/utils');
require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  TWITCH_CHANNEL,
  TWITCH_CLIENT_ID,
  TWITCH_SECRET,
  TWITCH_CHANNEL_ID,
  TWITCH_BOT_USERNAME,
  LOG_REWARD_IDS,
  MUSIC_REWARD_ID,
  STREAMERBOT_API_URL,
  STREAMERBOT_INTIM_ACTION,
  STREAMERBOT_POCELUY_ACTION,
  TOGETHER_API_KEY,
  HORNY_PAPS_BLOCKED_USERS,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}
if (!TWITCH_CHANNEL) {
  console.error('Missing Twitch bot configuration (TWITCH_CHANNEL)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const streamerBotApiBase = (
  (STREAMERBOT_API_URL && STREAMERBOT_API_URL.trim()) ||
  'http://localhost:7478'
).replace(/\/$/, '');

const streamerBot = createStreamerBotIntegration({
  baseUrl: streamerBotApiBase,
  actions: {
    intim: STREAMERBOT_INTIM_ACTION,
    poceluy: STREAMERBOT_POCELUY_ACTION,
  },
  handlers: streamerBotHandlers,
});

const togetherApiKey = (TOGETHER_API_KEY || '').trim();
if (!togetherApiKey) {
  console.error('Missing Together.ai configuration (TOGETHER_API_KEY)');
  process.exit(1);
}

const twitchConfig = {
  clientId: TWITCH_CLIENT_ID,
  secret: TWITCH_SECRET,
  channelId: TWITCH_CHANNEL_ID,
};

const tokenService = createTokenService({
  supabase,
  twitchConfig,
});

const userService = createUserService({
  supabase,
  getTwitchToken: tokenService.getTwitchToken,
  getStreamerToken: tokenService.getStreamerToken,
  twitchConfig,
});

const pollService = createPollService({ supabase });
const chatterService = createChatterService({ supabase });

const loggingService = createLoggingService({
  supabase,
  obsClient,
  twitchConfig,
  getStreamerToken: tokenService.getStreamerToken,
});

const streamState = {
  joinedThisStream: new Set(),
  streamOnline: null,
  currentStreamGame: null,
  streamStartedAt: null,
  firstMessageAchieved: false,
  firstMessageUserId: null,
};

const aiService = createAiService({
  supabase,
  togetherConfig: {
    chatUrl: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    timeoutMs: 10_000,
    apiKey: togetherApiKey,
  },
  getStreamMetadata: () => ({
    game: streamState.currentStreamGame,
    startedAt: streamState.streamStartedAt,
  }),
  aiConfig,
});

const client = new tmi.Client({
  options: { debug: false },
  connection: { secure: true, reconnect: true },
  channels: [TWITCH_CHANNEL],
});

const chatActionEnvMap = streamerBotChatActions || {};

function getChatActionId(actionKey) {
  if (!actionKey) return null;
  const envName = chatActionEnvMap[actionKey];
  if (!envName) {
    console.warn(`Streamer.bot chat action not mapped for key: ${actionKey}`);
    return null;
  }
  const raw = process.env[envName];
  if (!raw) {
    console.warn(
      `Streamer.bot chat action ${envName} is not configured; unable to relay chat message for ${actionKey}`
    );
    return null;
  }
  return raw.trim() || null;
}

async function sendChatMessage(actionKey, payload = {}) {
  const actionId = getChatActionId(actionKey);
  if (!actionId) return;
  const message = payload?.message;
  if (!message) return;
  const initiator = payload?.initiator ?? null;
  const target = payload?.target ?? null;
  const type = payload?.type ?? null;
  await streamerBot.triggerAction(actionId, {
    message,
    initiator,
    target,
    type,
  });
}

try {
  const connectResult = client.connect();
  if (connectResult && typeof connectResult.catch === 'function') {
    connectResult.catch((err) =>
      console.error('Failed to connect to Twitch chat', err)
    );
  }
} catch (err) {
  console.error('Failed to connect to Twitch chat', err);
}

if (TWITCH_CHANNEL) {
  userService.updateSubMonths(TWITCH_CHANNEL).catch((err) =>
    console.error('Initial sub check failed', err)
  );
}

let rewardIds = LOG_REWARD_IDS
  ? LOG_REWARD_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const defaultHornypapsBlockedUsers = ['nightbot', 'streamlabs'];
const hornypapsBlockedUsernames = Array.from(
  new Set(
    [
      ...defaultHornypapsBlockedUsers,
      ...(HORNY_PAPS_BLOCKED_USERS
        ? HORNY_PAPS_BLOCKED_USERS.split(',').map((name) => name.trim())
        : []),
    ]
      .map((name) => name.toLowerCase())
      .filter(Boolean)
  )
);

function getRewardIds() {
  return rewardIds;
}

function setRewardIds(nextIds) {
  rewardIds = nextIds;
}

if (typeof supabase.channel === 'function') {
  supabase
    .channel('settings')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'settings',
        filter: 'key=eq.accept_votes',
      },
      () => {
        pollService.invalidateAcceptVotesCache();
      }
    )
    .subscribe();
}

const lastCommandTimes = new Map();

client.on(
  'join',
  createJoinHandler({
    userService,
    streamState,
  })
);

client.on(
  'message',
  createMessageHandler({
    client,
    aiService,
    userService,
    pollService,
    loggingService,
    tokenService,
    sendChatMessage,
    streamerBot,
    supabase,
    lastCommandTimes,
    streamState,
    getRewardIds,
    config: {
      twitchChannelId: TWITCH_CHANNEL_ID,
      twitchClientId: TWITCH_CLIENT_ID,
      twitchBotUsername: TWITCH_BOT_USERNAME,
      musicRewardId: MUSIC_REWARD_ID,
      fetchRandomChatterUsername: chatterService.fetchRandomChatterUsername,
      getChatActionId,
      hornypapsBlockedUsernames,
    },
  })
);

client.on(
  'subscription',
  createSubscriptionHandler({
    loggingService,
    userService,
  })
);

client.on(
  'resub',
  createResubHandler({
    loggingService,
    userService,
  })
);

client.on(
  'subgift',
  createSubgiftHandler({
    loggingService,
    userService,
  })
);

client.on(
  'submysterygift',
  createSubmysterygiftHandler({
    userService,
  })
);

const backgroundTasks = createBackgroundTasks({
  supabase,
  loggingService,
  tokenService,
  userService,
  twitchConfig,
  streamState,
  getRewardIds,
  setRewardIds,
});

backgroundTasks.start();

module.exports = {
  parseCommand,
  addVote: pollService.addVote,
  checkDonations: backgroundTasks.checkDonations,
  findOrCreateUser: userService.findOrCreateUser,
  incrementUserStat: userService.incrementUserStat,
  updateSubMonths: userService.updateSubMonths,
  applyRandomPlaceholders: aiService.applyRandomPlaceholders,
};
