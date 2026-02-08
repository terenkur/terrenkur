const { commandHandlers } = require('../commands');
const { getFetch } = require('../services/fetch');
const { parseCommand } = require('./utils');

const HORNY_PAPS_THROTTLE_MS = 12 * 1000;
const HORNY_PAPS_MOOD_WINDOW_MS = 60 * 1000;
const HORNY_PAPS_BLOCKED_USERNAMES = ['nightbot', 'streamlabs'];
const HORNYPAPS_MOOD_WEIGHTS = {
  normal: 0.5,
  flirty: 0.2,
  sleepy: 0.1,
  aggressive: 0.2,
};
const HORNYPAPS_FALLBACK_REPLY = 'сейчас не могу ответить, но я рядом.';

const AFFINITY_RULES = {
  min: -100,
  max: 100,
  minStep: 1,
  maxStep: 5,
};

const AFFINITY_POSITIVE_WORDS = [
  'спасибо',
  'пасиба',
  'благодарю',
  'пожалуйста',
  'сорян',
  'извини',
  'люблю',
  'класс',
  'круто',
  'хорошо',
  'супер',
  'приятно',
  'молодец',
  'умничка',
  'красавчик',
  'красотка',
  'милый',
  'милая',
  'добрый',
  'добрая',
  'респект',
];

const AFFINITY_NEGATIVE_WORDS = [
  'дурак',
  'идиот',
  'тупой',
  'тупая',
  'бесишь',
  'ненавижу',
  'отстой',
  'плохой',
  'плохая',
  'урод',
  'уродина',
  'треш',
  'фу',
  'мерзко',
  'стыдно',
];

const AFFINITY_POSITIVE_PATTERNS = createWordBoundaryPatterns(
  AFFINITY_POSITIVE_WORDS
);
const AFFINITY_NEGATIVE_PATTERNS = createWordBoundaryPatterns(
  AFFINITY_NEGATIVE_WORDS
);

const AFFINITY_TOXIC_PATTERNS = [
  /иди\s+нах/i,
  /пошел\s+ты/i,
  /пошла\s+ты/i,
  /заткнись/i,
  /сука/i,
  /говно/i,
  /дебил/i,
];

const USER_FACT_DEBOUNCE_MS = 5 * 60 * 1000;
const USER_FACT_MIN_LENGTH = 2;
const USER_FACT_MAX_LENGTH = 80;
const USER_FACT_SOURCE_MAX_LENGTH = 200;

const USER_FACT_PATTERNS = [
  {
    key: 'name',
    pattern: /\bменя\s+зовут\s+([^\n\r,.;!?]+)/i,
  },
  {
    key: 'nickname',
    pattern: /\bмой\s+ник(?:нейм)?\s+([^\n\r,.;!?]+)/i,
  },
  {
    key: 'favorite_game',
    pattern:
      /\b(?:моя\s+любимая|мой\s+любимый|любимая)\s+игра\s+([^\n\r,.;!?]+)/i,
    lowerCase: true,
  },
  {
    key: 'favorite_games',
    pattern: /\bлюбимые\s+игр[ыа]\s+([^\n\r;!?]+)/i,
    lowerCase: true,
    splitList: true,
  },
];

function createWordBoundaryPatterns(words = []) {
  return words.map((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
  });
}

function clampAffinity(value) {
  return Math.min(AFFINITY_RULES.max, Math.max(AFFINITY_RULES.min, value));
}

function normalizeFactCandidate(value, { lowerCase = false } = {}) {
  if (!value) return null;
  const trimmed = value.toString().trim().replace(/^["'«»]+|["'«»]+$/g, '');
  if (
    trimmed.length < USER_FACT_MIN_LENGTH ||
    trimmed.length > USER_FACT_MAX_LENGTH
  ) {
    return null;
  }
  return lowerCase ? trimmed.toLowerCase() : trimmed;
}

function normalizeFactList(value, { lowerCase = false } = {}) {
  if (!value) return null;
  const parts = value
    .split(/,|;|\s+и\s+|\s*&\s*/i)
    .map((part) => normalizeFactCandidate(part, { lowerCase }))
    .filter(Boolean);
  if (!parts.length) return null;
  return Array.from(new Set(parts));
}

function extractUserFactsFromMessage(message) {
  const facts = [];
  for (const rule of USER_FACT_PATTERNS) {
    const match = message.match(rule.pattern);
    if (!match) continue;
    const rawValue = match[1];
    const value = rule.splitList
      ? normalizeFactList(rawValue, { lowerCase: rule.lowerCase })
      : normalizeFactCandidate(rawValue, { lowerCase: rule.lowerCase });
    if (!value) continue;
    facts.push({ key: rule.key, value });
  }
  return facts;
}

function readFactValue(entry) {
  if (!entry) return null;
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
      return entry.value;
    }
  }
  return entry;
}

function createFactSource(tags, message) {
  const text = message.slice(0, USER_FACT_SOURCE_MAX_LENGTH);
  return {
    message_id: tags?.id || null,
    text,
  };
}

function countAffinityMatches(message, patterns) {
  return patterns.reduce((count, pattern) => {
    return pattern.test(message) ? count + 1 : count;
  }, 0);
}

function getAffinityAdjustment(message) {
  const normalizedMessage = String(message || '').toLowerCase();
  const positiveCount = countAffinityMatches(
    normalizedMessage,
    AFFINITY_POSITIVE_PATTERNS
  );
  const negativeCount = countAffinityMatches(
    normalizedMessage,
    AFFINITY_NEGATIVE_PATTERNS
  );
  const toxicCount = countAffinityMatches(
    normalizedMessage,
    AFFINITY_TOXIC_PATTERNS
  );

  if (!positiveCount && !negativeCount && !toxicCount) {
    return { delta: 0, note: '' };
  }

  let rawDelta = positiveCount - negativeCount - toxicCount * 3;
  if (rawDelta > 0) {
    rawDelta = Math.min(rawDelta, AFFINITY_RULES.maxStep);
    rawDelta = Math.max(rawDelta, AFFINITY_RULES.minStep);
  } else if (rawDelta < 0) {
    rawDelta = Math.max(rawDelta, -AFFINITY_RULES.maxStep);
    rawDelta = Math.min(rawDelta, -AFFINITY_RULES.minStep);
  }

  let note = '';
  if (toxicCount > 0) {
    note = 'Токсичное сообщение';
  } else if (negativeCount > 0) {
    note = 'Негативная лексика';
  } else if (positiveCount > 0) {
    note = 'Вежливое сообщение';
  }

  return { delta: rawDelta, note };
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

async function fetchYoutubeTitle(url) {
  const timeoutMs = 4_000;
  try {
    const fetchImpl = await getFetch();
    const oembed = new URL('https://www.youtube.com/oembed');
    oembed.searchParams.set('format', 'json');
    oembed.searchParams.set('url', url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    let resp;
    try {
      resp = await fetchImpl(oembed.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.title || null;
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('YouTube title fetch timed out', { url, timeoutMs });
      return null;
    }
    console.error('Failed to fetch YouTube title', err);
    return null;
  }
}

function createMessageHandler({
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
  config,
  streamState,
  getRewardIds,
} = {}) {
  if (!client) {
    throw new Error('Message handler requires tmi client');
  }

  let lastHornypapsReplyAt = 0;
  let hornypapsTagTimestamps = [];
  const factUpdateTimestamps = new Map();

  return async function handleMessage(channel, tags, message, self) {
    if (self) return;

    let user;
    try {
      user = await userService.findOrCreateUser(tags);
      if (!streamState.firstMessageAchieved) {
        try {
          await userService.checkAndAwardAchievements(user.id, 'first_message', 1);
        } catch (err) {
          console.error('first message achievement failed', err);
        }
        streamState.firstMessageAchieved = true;
        streamState.firstMessageUserId = user.id;
      }
      if (streamState.streamOnline && tags.username.toLowerCase() !== 'hornypaps') {
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
          await userService.checkAndAwardAchievements(
            user.id,
            'message_count',
            messageCount
          );
        } catch (err) {
          console.error('stream chatter update failed', err);
        }
      }
      await userService.incrementUserStat(user.id, 'total_chat_messages_sent');
      if (message.trim().startsWith('!')) {
        await userService.incrementUserStat(user.id, 'total_commands_run');
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
            await userService.incrementUserStat(mentioned.id, 'total_times_tagged');
          }
        })
      );
    } catch (err) {
      console.error('message stat update failed', err);
    }

    if (!user) {
      console.error('message handler could not resolve user', {
        username: tags?.username,
      });
      if (sendChatMessage) {
        await sendChatMessage(
          channel,
          'не удалось получить данные пользователя, попробуй позже.'
        );
      }
      return;
    }

    const trimmedMessage = message.trim();
    const isCommandMessage = trimmedMessage.startsWith('!');
    aiService.addChatHistory({
      username: tags.username,
      role: 'user',
      message: trimmedMessage,
    });

    if (user) {
      const affinityAdjustment = getAffinityAdjustment(trimmedMessage);
      if (affinityAdjustment.delta) {
        try {
          const currentAffinity =
            typeof user.affinity === 'number' && Number.isFinite(user.affinity)
              ? user.affinity
              : 0;
          const nextAffinity = clampAffinity(
            currentAffinity + affinityAdjustment.delta
          );
          const updatePayload = { affinity: nextAffinity };
          if (affinityAdjustment.note) {
            updatePayload.last_affinity_note = affinityAdjustment.note;
          }
          const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', user.id)
            .select('affinity, last_affinity_note')
            .maybeSingle();
          if (error) {
            console.error('Failed to update user affinity', error);
          } else if (updatedUser) {
            user.affinity = updatedUser.affinity;
            user.last_affinity_note = updatedUser.last_affinity_note;
          }
        } catch (err) {
          console.error('Affinity heuristic failed', err);
        }
      }
    }

    if (user && !isCommandMessage) {
      const extractedFacts = extractUserFactsFromMessage(trimmedMessage);
      if (extractedFacts.length) {
        try {
          const existingFacts = await userService.fetchUserFacts({
            userId: user.id,
            twitchLogin: user.twitch_login || null,
          });
          const now = Date.now();
          const source = createFactSource(tags, trimmedMessage);
          let updatedFacts = { ...(existingFacts || {}) };
          let hasUpdates = false;

          for (const { key, value } of extractedFacts) {
            const debounceKey = `${user.id}:${key}`;
            const lastUpdateAt = factUpdateTimestamps.get(debounceKey) || 0;
            if (now - lastUpdateAt < USER_FACT_DEBOUNCE_MS) {
              continue;
            }
            const previousValue = readFactValue(updatedFacts[key]);
            const nextValueSerialized = JSON.stringify(value);
            const prevValueSerialized = JSON.stringify(previousValue);
            if (nextValueSerialized === prevValueSerialized) {
              continue;
            }
            updatedFacts = {
              ...updatedFacts,
              [key]: {
                value,
                source,
                updated_at: new Date(now).toISOString(),
              },
            };
            factUpdateTimestamps.set(debounceKey, now);
            hasUpdates = true;
          }

          if (hasUpdates) {
            await userService.updateUserFacts(user.id, updatedFacts);
          }
        } catch (err) {
          console.error('Failed to update user facts', err);
        }
      }
    }

    if (!isCommandMessage && /@hornypaps\b/i.test(trimmedMessage)) {
      const normalizedSender = aiService.normalizeUsername(tags.username);
      const normalizedBot = aiService.normalizeUsername(config.twitchBotUsername);
      if (
        normalizedSender &&
        (normalizedSender === 'hornypaps' ||
          (normalizedBot && normalizedSender === normalizedBot) ||
          HORNY_PAPS_BLOCKED_USERNAMES.includes(normalizedSender))
      ) {
        return;
      }
      const now = Date.now();
      hornypapsTagTimestamps = hornypapsTagTimestamps.filter(
        (timestamp) => now - timestamp <= HORNY_PAPS_MOOD_WINDOW_MS
      );
      hornypapsTagTimestamps.push(now);
      const hornypapsRole = aiService.getHornypapsUserRole(tags);
      const loginForLookup = aiService.normalizeUsername(tags.username);
      let affinitySnapshot = null;
      try {
        affinitySnapshot = await userService.fetchUserAffinity({
          userId: user?.id,
          twitchLogin: loginForLookup || null,
        });
      } catch (err) {
        console.error('Failed to fetch affinity for Hornypaps', err);
      }
      let userFacts = null;
      try {
        userFacts = await userService.fetchUserFacts({
          userId: user?.id,
          twitchLogin: loginForLookup || null,
        });
      } catch (err) {
        console.error('Failed to fetch user facts for Hornypaps', err);
      }
      const factsMetadata = aiService.formatUserFactsMetadata(userFacts);
      const affinityValue =
        typeof affinitySnapshot?.affinity === 'number'
          ? affinitySnapshot.affinity
          : user?.affinity ?? null;
      const moodWeights = aiService.adjustHornypapsMoodWeights(HORNYPAPS_MOOD_WEIGHTS, {
        tagCount: hornypapsTagTimestamps.length,
        role: hornypapsRole,
        affinity: affinityValue ?? 0,
      });
      const mood = aiService.pickWeightedMood(moodWeights) || 'normal';
      if (now - lastHornypapsReplyAt >= HORNY_PAPS_THROTTLE_MS) {
        lastHornypapsReplyAt = now;
        let reply = null;
        try {
          reply = await aiService.generateHornypapsReply({
            username: tags.username,
            role: 'user',
            message: trimmedMessage,
            history: aiService.getChatHistorySnapshot(),
            mood,
            userAffinity: affinityValue,
            userMetadata: factsMetadata,
            lastAffinityNote:
              affinitySnapshot?.last_affinity_note ?? user?.last_affinity_note ?? null,
          });
        } catch (err) {
          console.error('Hornypaps reply generation failed', err);
        }

        if (!reply) {
          reply = HORNYPAPS_FALLBACK_REPLY;
        }

        const mentionPattern = new RegExp(
          `@${aiService.escapeRegExp(tags.username)}`,
          'i'
        );
        if (!mentionPattern.test(reply)) {
          reply = `@${tags.username} ${reply}`.trim();
        }

        try {
          const actionId = config.getChatActionId('hornypapsReply');
          if (actionId) {
            await streamerBot.triggerAction(actionId, {
              message: reply,
              initiator: tags.username,
              type: 'hornypaps',
            });
          } else {
            await client.say(channel, reply);
          }
          aiService.addChatHistory({
            username: 'hornypaps',
            role: 'assistant',
            message: reply,
          });
        } catch (err) {
          console.error('Hornypaps reply send failed', err);
          const errorText = (err && err.message) ? err.message : String(err || '');
          if (/Cannot send anonymous messages/i.test(errorText)) {
            console.error(
              'Hint: Streamer.bot needs to be authorized in Twitch and the chat send action must be configured correctly.'
            );
          }
        }
      }
      return;
    }

    const [rawCommand] = trimmedMessage.split(/\s+/);
    const normalizedCommand = rawCommand ? rawCommand.toLowerCase() : '';
    if (normalizedCommand.startsWith('!')) {
      const handler = commandHandlers.get(normalizedCommand);
      if (handler) {
        await handler({
          channel,
          tags,
          message,
          user,
          services: {
            sendChatMessage,
            streamerBot,
            supabase,
            lastCommandTimes,
            getStreamerToken: tokenService.getStreamerToken,
            incrementUserStat: userService.incrementUserStat,
            fetchRandomChatterUsername: config.fetchRandomChatterUsername,
            generateWhereLocation: aiService.generateWhereLocation,
            pickFallbackLocation: aiService.pickFallbackLocation,
            ensureDistinctWhereLocation: aiService.ensureDistinctWhereLocation,
            generateWhenTime: aiService.generateWhenTime,
            pickFallbackWhenTime: aiService.pickFallbackWhenTime,
            ensureDistinctWhenTime: aiService.ensureDistinctWhenTime,
            generateWhatAction: aiService.generateWhatAction,
            pickFallbackWhatAction: aiService.pickFallbackWhatAction,
            ensureDistinctWhatAction: aiService.ensureDistinctWhatAction,
            generateWhereToDestination: aiService.generateWhereToDestination,
            pickFallbackWhereToDestination: aiService.pickFallbackWhereToDestination,
            ensureDistinctWhereToDestination: aiService.ensureDistinctWhereToDestination,
            generateIntimVariantOne: aiService.generateIntimVariantOne,
            generatePoceluyVariantTwo: aiService.generatePoceluyVariantTwo,
            generatePoceluyVariantThree: aiService.generatePoceluyVariantThree,
            generatePoceluyVariantFour: aiService.generatePoceluyVariantFour,
            applyRandomPlaceholders: aiService.applyRandomPlaceholders,
            logEvent: loggingService.logEvent,
            config: {
              twitchChannelId: config.twitchChannelId,
              twitchClientId: config.twitchClientId,
            },
          },
        });
        return;
      }
      if (!['!игра', '!game'].includes(normalizedCommand)) {
        return;
      }
    }

    const EXTRA_VOTE_REWARD_ID = 'e776c465-7f7a-4a41-8593-68165248ecd8';
    const rewardId = tags['custom-reward-id'];
    if (rewardId === EXTRA_VOTE_REWARD_ID) {
      try {
        const rewardUser = await userService.findOrCreateUser(tags);
        await userService.incrementUserStat(rewardUser.id, 'vote_limit', 1);
        await sendChatMessage('rewardExtraVote', {
          message: `@${tags.username}, вам добавлен дополнительный голос.`,
          initiator: tags.username,
          type: 'success',
        });
      } catch (err) {
        console.error('extra vote reward failed', err);
      }
    } else if (config.musicRewardId && rewardId === config.musicRewardId) {
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
        await sendChatMessage('musicInvalidLink', {
          message: `@${tags.username}, invalid YouTube link.`,
          initiator: tags.username,
          type: 'error',
        });
        return;
      }
      const preview = getYoutubeThumbnail(text);
      const title = await fetchYoutubeTitle(text);
      const name = (await loggingService.fetchRewardName(rewardId)) || rewardId;
      try {
        const { error: queueError } = await supabase.from('music_queue').insert({
          url: text,
          title: title || null,
          preview_url: preview || null,
          requested_by: tags['display-name'] || tags.username || null,
          status: 'pending',
        });
        if (queueError) {
          throw queueError;
        }
        await sendChatMessage('musicQueued', {
          message: `@${tags.username}, трек добавлен в очередь.`,
          initiator: tags.username,
          type: 'success',
        });
      } catch (queueErr) {
        console.error('Failed to enqueue music request', queueErr);
      }
      await loggingService.logEvent(
        `Reward ${name} redeemed by ${tags['display-name'] || tags.username}: ${text}`,
        text,
        preview,
        title
      );
    } else if (rewardId) {
      const rewardIds = getRewardIds();
      if (rewardIds.length === 0 || rewardIds.includes(rewardId)) {
        const text = message.trim();
        const name = (await loggingService.fetchRewardName(rewardId)) || rewardId;
        await loggingService.logEvent(
          `Reward ${name} redeemed by ${tags['display-name'] || tags.username}` +
            (text ? `: ${text}` : '')
        );
      }
    }

    const parsed = parseCommand(message);
    if (!parsed) return;
    const { args } = parsed;
    const [firstArg, ...restArgs] = args;
    if (!firstArg) {
      await sendChatMessage('pollHelp', {
        message:
          'Вы можете проголосовать за игру из списка командой !игра [Название игры или номер]. Получить список игр - !игра список',
        initiator: tags.username,
        type: 'info',
      });
      return;
    }

    const sub = firstArg.toLowerCase();

    if (sub === 'список') {
      try {
        const poll = await pollService.getActivePoll();
        if (!poll) {
          await sendChatMessage('pollNoActive', {
            message: `@${tags.username}, сейчас нет активной рулетки.`,
            initiator: tags.username,
            type: 'info',
          });
          return;
        }
        const games = await pollService.getGamesForPoll(poll.id);
        const names = games
          .map((g, index) => `${index + 1}. ${g.name} - ${g.votes}`)
          .join(' | ');
        await sendChatMessage('pollList', {
          message: names,
          initiator: tags.username,
          type: 'list',
        });
      } catch (err) {
        console.error(err);
        await sendChatMessage('pollListError', {
          message: `@${tags.username}, произошла ошибка при получении списка игр.`,
          initiator: tags.username,
          type: 'error',
        });
      }
      return;
    }

    if (sub === 'голоса') {
      try {
        const poll = await pollService.getActivePoll();
        if (!poll) {
          await sendChatMessage('pollNoActive', {
            message: `@${tags.username}, сейчас нет активной рулетки.`,
            initiator: tags.username,
            type: 'info',
          });
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
        let messageText = `@${tags.username}, у вас осталось ${remaining} голосов.`;
        if (details) {
          messageText += ` Вы проголосовали за: ${details}.`;
        }
        await sendChatMessage('pollVotesStatus', {
          message: messageText,
          initiator: tags.username,
          type: 'info',
        });
      } catch (err) {
        console.error(err);
        await sendChatMessage('pollVotesError', {
          message: `@${tags.username}, произошла ошибка при подсчёте голосов.`,
          initiator: tags.username,
          type: 'error',
        });
      }
      return;
    }

    const gameName = [firstArg, ...restArgs].join(' ');

    try {
      const poll = await pollService.getActivePoll();
      if (!poll) {
        await sendChatMessage('pollNoActive', {
          message: `@${tags.username}, сейчас нет активной рулетки.`,
          initiator: tags.username,
          type: 'info',
        });
        return;
      }

      const votingOpen = await pollService.isVotingEnabled();
      if (!votingOpen) {
        await sendChatMessage('pollVotingClosed', {
          message: `@${tags.username}, приём голосов закрыт.`,
          initiator: tags.username,
          type: 'info',
        });
        return;
      }

      const games = await pollService.getGamesForPoll(poll.id);
      const isNumericSelection = args.length === 1 && /^\d+$/.test(firstArg);
      let game = null;
      if (isNumericSelection) {
        const index = Number.parseInt(firstArg, 10);
        if (index < 1 || index > games.length) {
          await sendChatMessage('pollGameNotFound', {
            message: `@${tags.username}, неверный номер игры.`,
            initiator: tags.username,
            type: 'info',
          });
          return;
        }
        game = games[index - 1];
      } else {
        game = games.find((g) => g.name.toLowerCase() === gameName.toLowerCase());
        if (!game) {
          await sendChatMessage('pollGameNotFound', {
            message: `@${tags.username}, игра "${gameName}" не найдена в рулетке.`,
            initiator: tags.username,
            type: 'info',
          });
          return;
        }
      }

      const result = await pollService.addVote(user, poll.id, game.id);
      if (result.success) {
        await sendChatMessage('pollVoteSuccess', {
          message: `@${tags.username}, голос за "${game.name}" засчитан!`,
          initiator: tags.username,
          type: 'success',
        });
      } else if (result.reason === 'vote limit reached') {
        await sendChatMessage('pollVoteLimit', {
          message: `@${tags.username}, лимит голосов исчерпан.`,
          initiator: tags.username,
          type: 'info',
        });
      } else {
        await sendChatMessage('pollVoteTechnical', {
          message: `@${tags.username}, не удалось обработать голос из-за технических проблем.`,
          initiator: tags.username,
          type: 'error',
        });
      }
    } catch (err) {
      console.error(err);
      await sendChatMessage('pollVoteProcessingError', {
        message: `@${tags.username}, произошла ошибка при обработке голоса.`,
        initiator: tags.username,
        type: 'error',
      });
    }
  };
}

module.exports = {
  createMessageHandler,
};
