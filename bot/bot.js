const tmi = require('tmi.js');
const { createClient } = require('@supabase/supabase-js');
const obsClient = require('./obsClient');
const {
  createStreamerBotIntegration,
} = require('./streamerBotClient');
const streamerBotHandlers = require('./streamerBotHandlers');
require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  TWITCH_CHANNEL,
  TWITCH_CLIENT_ID,
  TWITCH_SECRET,
  TWITCH_CHANNEL_ID,
  LOG_REWARD_IDS,
  MUSIC_REWARD_ID,
  STREAMERBOT_API_URL,
  STREAMERBOT_INTIM_ACTION,
  STREAMERBOT_POCELUY_ACTION,
} = process.env;

const streamerBotChatActions = require('../shared/streamerBotChatActions');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}
if (!TWITCH_CHANNEL) {
  console.error('Missing Twitch bot configuration (TWITCH_CHANNEL)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ACCEPT_VOTES_TTL_MS = 30 * 1000;
let cachedAcceptVotes = null;
let acceptVotesFetchedAt = 0;

function invalidateAcceptVotesCache() {
  cachedAcceptVotes = null;
  acceptVotesFetchedAt = 0;
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
        invalidateAcceptVotesCache();
      }
    )
    .subscribe();
}

const STREAMERBOT_DEFAULT_API_BASE = 'http://localhost:7478';
const streamerBotApiBase = (
  (STREAMERBOT_API_URL && STREAMERBOT_API_URL.trim()) ||
  STREAMERBOT_DEFAULT_API_BASE
).replace(/\/$/, '');

const streamerBot = createStreamerBotIntegration({
  baseUrl: streamerBotApiBase,
  actions: {
    intim: STREAMERBOT_INTIM_ACTION,
    poceluy: STREAMERBOT_POCELUY_ACTION,
  },
  handlers: streamerBotHandlers,
});

const TOGETHER_CHAT_URL = 'https://api.together.xyz/v1/chat/completions';
const TOGETHER_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
const WHERE_FALLBACK_LOCATIONS = [
  'в баре',
  'на кухне',
  'в метро',
  'в библиотеке',
  'на стриме',
  'в парке',
  'в кино',
  'в космосе',
  'под мостом',
  'на крыше небоскрёба',
  'в поезде-призраке',
  'в секретной оранжерее',
  'в закулисье цирка',
  'в ретро-аркаде',
  'на заброшенном пирсе',
  'в чайной на колёсах',
];

const WHERE_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь место в ответ на команду !где. ' +
  'Отвечай только одной короткой фразой с местом в нижнем регистре, без пояснений и знаков препинания. ' +
  'Меняй стили, добавляй атмосферные детали и избегай повторов, чтобы каждое место звучало свежо и забавно. Ответ должен быть на вопрос "где?"';

const HORNYPAPS_SYSTEM_PROMPT =
  'Ты — Hornypaps, дерзкий, игривый и уверенный персонаж чата. ' +
  'Отвечай на русском, коротко (1–2 предложения), по делу и с лёгким флиртом, но без грубостей и без явной непристойности. ' +
  'Можно обращаться к собеседнику по нику, сохраняй дружелюбный тон и избегай токсичности.';

let lastWhereLocation = '';

const WHEN_FALLBACK_TIMES = [
  'через пять минут',
  'после полуночи',
  'перед первым кофе',
  'когда чат зевнёт в унисон',
  'к следующему полнолунию',
  'как только гусь в чате крикнет',
  'через три песни на фоновой волне',
  'в воскресенье ближе к сумеркам',
  'когда донаты станцуют польку',
  'вторник ровно в 19:07',
  'по окончании следующего раунда',
  'пока чайник не свистнет трижды',
  'как только выпадет редкий дроп',
  'на рассвете со звуком уведомлений',
  'в полночь по времени стримера',
  'когда чат договорится об эмоте',
];

const WHEN_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь время в ответ на команду !когда. ' +
  'Отвечай только одной короткой фразой в нижнем регистре, описывающей момент или период, без пояснений и знаков препинания. ' +
  'Меняй формулировки, добавляй атмосферные детали и избегай повторов, чтобы каждое время звучало свежо и забавно. Ответ должен быть на вопрос "когда?"';

let lastWhenTime = '';

const WHAT_FALLBACK_ACTIONS = [
  'пицца с ананасами',
  'реакция в чатике',
  'фанфик про стрим',
  'донатное табло',
  'фирменный эмот',
  'обрезанные клипы',
  'закулисье чата',
  'свежий мем',
  'ловит вдохновение из доната',
  'остылый энергетик',
];

const WHAT_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь, что делает зритель или ведущий, в ответ на команду !что. ' +
  'Отвечай только одной короткой фразой в нижнем регистре, описывающей предмет, явление, без пояснений, глаголов и знаков препинания. ' +
  'Меняй формулировки и добавляй абсурдные детали, чтобы каждый ответ звучал свежо и забавно. Ответ должен быть на вопрос "что?"';

const WHERETO_FALLBACK_DESTINATIONS = [
  'за острым раменом',
  'на марс',
  'на ночной поезд в прагу',
  'на подпольный квест',
  'в портальную воронку',
  'в бассейн с мармеладом',
  'на рейв в бункере',
  'в ретрит молчания',
  'за новой эмоцией',
  'к сияющему айсбергу',
];

const WHERETO_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь направление в ответ на команду !куда. ' +
  'Отвечай только одной короткой фразой в нижнем регистре без пояснений и знаков препинания, описывая движение или путь. Без глагола в начале ответа' +
  'Меняй стили, добавляй атмосферные детали и избегай повторов, чтобы каждое направление звучало свежо и забавно. Ответ должен быть на вопрос "куда?"';

let lastWhereToDestination = '';
let lastWhatAction = '';

const CHAT_HISTORY_SIZE = 30;
const chatHistory = [];
let chatHistoryIndex = 0;

const HORNY_PAPS_THROTTLE_MS = 12 * 1000;
const HORNYPAPS_FALLBACK_REPLY = 'сейчас не могу ответить, но я рядом.';
let lastHornypapsReplyAt = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFetch() {
  if (typeof global.fetch === 'function') {
    return global.fetch;
  }

  const { default: nodeFetch } = await import('node-fetch');
  global.fetch = nodeFetch;
  return nodeFetch;
}

function extractTogetherMessageContent(content) {
  if (!content) return '';

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }

  return '';
}

async function requestTogetherChat({
  messages,
  maxTokens = 100,
  temperature = 0.8,
  topP = 0.9,
  normalize = (value) => value,
  retries = 2,
} = {}) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  const fetchImpl = await getFetch();
  const body = {
    model: TOGETHER_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
  };

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(TOGETHER_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Together.ai returned an invalid response');
      }

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `Together.ai responded with status ${response.status}: ${errorText}`
        );
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const rawContent = extractTogetherMessageContent(
        data?.choices?.[0]?.message?.content
      );
      const normalized = normalize(rawContent);
      if (normalized) {
        return {
          raw: rawContent,
          text: normalized,
        };
      }

      if (attempt < retries) {
        await delay(200 * (attempt + 1));
        continue;
      }

      return null;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await delay(200 * (attempt + 1));
        continue;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

const INTIM_VARIANT_SYSTEM_PROMPT =
  'Ты — остроумный ассистент стрима и придумываешь пикантные обстоятельства для команды !интим. ' +
  'Отвечай только одной короткой фразой в нижнем регистре без завершающей точки. ' +
  'Фраза может быть игривой, романтичной, пошлой или дерзкой, но избегай откровенно оскорбительного. ' +
  'Иногда используй переменные [от (минимальное число) до (максимальное число)] или [random_chatter], чтобы бот смог подставить случайные числа и зрителей.';

const POCELUY_VARIANT_SYSTEM_PROMPT =
  'Ты — остроумный ассистент стрима и придумываешь флиртовые вставки для команды !поцелуй. ' +
  'Отвечай только одной короткой фразой в нижнем регистре без завершающей точки. ' +
  'Фраза может быть романтичной, смешной, пошлой или дерзкой, допускается мат, но избегай откровенно оскорбительного. ' +
  'Иногда используй переменные [от (минимальное число) до (максимальное число)] или [random_chatter], чтобы бот смог подставить случайные числа и зрителей.';

function normalizeWhereLocation(value) {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .trim();
}

function rememberWhereLocation(location) {
  lastWhereLocation = normalizeWhereLocation(location);
}

function normalizeWhenTime(value) {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .trim();
}

function rememberWhenTime(time) {
  lastWhenTime = normalizeWhenTime(time);
}

function normalizeWhereToDestination(value) {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .trim();
}

function normalizeWhatAction(value) {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .trim();
}

function rememberWhereToDestination(destination) {
  lastWhereToDestination = normalizeWhereToDestination(destination);
}

function rememberWhatAction(action) {
  lastWhatAction = normalizeWhatAction(action);
}

function normalizeHornypapsReply(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/\s+([,.!?…])/g, '$1')
    .trim();
}

function addChatHistory(entry) {
  if (!entry || !entry.message) return;
  if (chatHistory.length < CHAT_HISTORY_SIZE) {
    chatHistory.push(entry);
  } else {
    chatHistory[chatHistoryIndex] = entry;
    chatHistoryIndex = (chatHistoryIndex + 1) % CHAT_HISTORY_SIZE;
  }
}

function getChatHistorySnapshot() {
  if (chatHistory.length < CHAT_HISTORY_SIZE || chatHistoryIndex === 0) {
    return [...chatHistory];
  }
  return [
    ...chatHistory.slice(chatHistoryIndex),
    ...chatHistory.slice(0, chatHistoryIndex),
  ];
}

function normalizeUsername(value) {
  if (!value) return '';
  return value.toString().trim().replace(/^@/, '').toLowerCase();
}

async function fetchWhereMentionCandidates(subjectText, limit = 3) {
  const exclude = new Set();
  const normalizedSubject = normalizeUsername(subjectText);
  if (normalizedSubject) {
    exclude.add(normalizedSubject);
  }

  try {
    const { data, error } = await supabase
      .from('stream_chatters')
      .select('users ( username )');
    if (error) throw error;

    const rawNames = (data || [])
      .map((entry) => entry?.users?.username)
      .filter(Boolean)
      .map((name) => name.toString().trim())
      .filter((name) => name);

    const uniqueNames = [];
    for (const name of rawNames) {
      const normalized = normalizeUsername(name);
      if (!normalized || exclude.has(normalized)) continue;
      if (uniqueNames.find((n) => normalizeUsername(n) === normalized)) continue;
      uniqueNames.push(name);
    }

    if (!uniqueNames.length) {
      return [];
    }

    const sample = [];
    const pool = [...uniqueNames];
    while (pool.length && sample.length < limit) {
      const idx = Math.floor(Math.random() * pool.length);
      const [name] = pool.splice(idx, 1);
      sample.push(name);
    }

    return sample;
  } catch (err) {
    console.error('Failed to fetch where chatter mentions', err);
    return [];
  }
}

function normalizeIntimVariant(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .toLowerCase();
}

async function fetchIntimMentionCandidates({
  chatters = null,
  exclude = new Set(),
  limit = 5,
} = {}) {
  let source = Array.isArray(chatters) ? chatters : null;

  if (!source || !source.length) {
    try {
      const { data, error } = await supabase
        .from('stream_chatters')
        .select('users ( username )');
      if (error) throw error;
      source = data || [];
    } catch (err) {
      console.error('Failed to fetch intim chatter mentions', err);
      return [];
    }
  }

  const rawNames = (source || [])
    .map((entry) => entry?.users?.username)
    .filter(Boolean)
    .map((name) => name.toString().trim())
    .filter((name) => name);

  if (!rawNames.length) {
    return [];
  }

  const unique = [];
  for (const name of rawNames) {
    const normalized = normalizeUsername(name);
    if (!normalized || exclude.has(normalized)) continue;
    if (unique.find((existing) => normalizeUsername(existing) === normalized)) {
      continue;
    }
    unique.push(name);
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

function createEventTargetInstruction({
  targetName = '',
  isSelf = false,
  wasTagged = false,
  hadTag = false,
} = {}) {
  const parts = ['Объект события:'];

  if (isSelf && wasTagged) {
    parts.push('сам автор, он отметил себя через тег.');
  } else if (isSelf) {
    parts.push('сам автор команды.');
  } else if (wasTagged) {
    parts.push('зритель, которого автор отметил через тег.');
  } else if (targetName) {
    if (hadTag) {
      parts.push('случайный зритель, тег не сработал.');
    } else {
      parts.push('случайный зритель.');
    }
  } else if (hadTag) {
    parts.push('тег не найден, ориентируйся на случайного зрителя.');
  } else {
    parts.push('получи общее нейтральное описание без конкретных имён.');
  }

  if (targetName) {
    parts.push(`Ник @${targetName} уже упоминается отдельно, не произноси его напрямую.`);
  } else {
    parts.push('Не произноси конкретные ники, используй обтекаемые формулировки.');
  }
  parts.push(
    'Этот объект должен оставаться центром сцены; не смещай фокус на посторонних.'
  );

  return parts.join(' ');
}

async function generateIntimVariantOne({
  fallback = '',
  authorName = '',
  partnerName = '',
  chatters = null,
  extraText = '',
  targetName = '',
  isSelf = false,
  wasTagged = false,
  hadTag = false,
} = {}) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return fallback || '';
  }

  const exclude = new Set();
  if (authorName) {
    exclude.add(normalizeUsername(authorName));
  }
  if (partnerName) {
    exclude.add(normalizeUsername(partnerName));
  }
  if (targetName) {
    exclude.add(normalizeUsername(targetName));
  }

  const mentionCandidates = await fetchIntimMentionCandidates({
    chatters,
    exclude,
  });

  const instructions = [];
  if (authorName) {
    instructions.push(
      `Автор команды: @${authorName}. Не упоминай его напрямую.`
    );
  }
  if (partnerName) {
    instructions.push(
      `Партнёр по умолчанию: @${partnerName}. Не упоминай его напрямую.`
    );
  }
  instructions.push(
    'Обстоятельство должно без изменения ложиться внутрь шаблона «у пользователя1 [место для обстоятельства] будет интим с пользователем2» как обстоятельство места/времени/образа действия; не добавляй новое подлежащее или сказуемое и не начинай фразу с союзов.'
  );
  instructions.push(
    'главный участник интимной сцены — выбранный ботом партнёр, третьи лица остаются фоном'
  );
  if (fallback) {
    instructions.push(`Не повторяй дословно \"${fallback}\".`);
  }
  const targetInstruction = createEventTargetInstruction({
    targetName,
    isSelf,
    wasTagged,
    hadTag,
  });
  if (targetInstruction) {
    instructions.push(targetInstruction);
  }
  instructions.push(
    [
      'Учитывай дополнительный пользовательский текст (может отсутствовать).',
      extraText
        ? `Текст: "${extraText}". Постарайся обыграть его.`
        : 'Дополнительный текст отсутствует.',
    ].join(' ')
  );
  if (mentionCandidates.length) {
    instructions.push(
      `среди зрителей сейчас: ${mentionCandidates
        .map((name) => `@${name}`)
        .join(', ')} — их можно упоминать только как фон, они не становятся объектом интима, главным остаётся выбранный ботом партнёр`
    );
  } else {
    instructions.push(
      'Имея один шанс из трёх, можешь добавить случайного зрителя или зрителей, используя переменные [random_chatter] — бот подставит имена, но добавленные зрители не должны быть основным объектом влечения, либо косвенно упомянуты'
    );
  }
  instructions.push(
    'Для случайных чисел можно использовать переменные [от (минимальное число) до (максимальное число)]'
  );
  instructions.push(
    'Фраза должна состоять из одной короткой конструкции.'
  );

  const messages = [
    {
      role: 'system',
      content: INTIM_VARIANT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        'Придумай новое обстоятельство для шуточного шаблонного ответа:`У пользователя1 [место для обстоятельства] будет интим с пользователем2`. Обстоятельство обязано подходит в смысловом плане под это шаблонное предложение. Не нужно использовать данное шаблонное предложение при формировании обстоятельства и упоминать пользователя1 и пользователя2',
        instructions.join(' '),
        'Ответ должен быть одной фразой в нижнем регистре без финальной точки. Можно использовать мат. Учитывай дополнительный текст и объект интима',
      ]
        .filter(Boolean)
        .join(' '),
    },
  ];

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 100,
      temperature: 0.8,
      topP: 0.9,
      normalize: normalizeIntimVariant,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error('Failed to fetch Together.ai intim variant', err);
  }

  return fallback || '';
}

async function generatePoceluyVariant({
  fallback = '',
  authorName = '',
  partnerName = '',
  chatters = null,
  extraText = '',
  targetName = '',
  isSelf = false,
  wasTagged = false,
  hadTag = false,
  placementHint = '',
  variantLabel = 'general',
} = {}) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return fallback || '';
  }

  const exclude = new Set();
  if (authorName) {
    exclude.add(normalizeUsername(authorName));
  }
  if (partnerName) {
    exclude.add(normalizeUsername(partnerName));
  }
  if (targetName) {
    exclude.add(normalizeUsername(targetName));
  }

  const mentionCandidates = await fetchIntimMentionCandidates({
    chatters,
    exclude,
  });

  const instructions = [];
  if (authorName) {
    instructions.push(
      `Автор команды: @${authorName}. Не упоминай его напрямую.`
    );
  }
  if (partnerName) {
    instructions.push(
      `Партнёр по умолчанию: @${partnerName}. Не упоминай его напрямую.`
    );
  }
  instructions.push(
    'Обстоятельство должно вставляться сразу после инициатора команды и перед словом «поцелует» в шаблоне «пользователь1 [место для обстоятельства] поцелует что-то пользователя2»; избегай союзов и глаголов в начале и не добавляй новое подлежащее.'
  );
  if (fallback) {
    instructions.push(`Не повторяй дословно "${fallback}".`);
  }
  if (placementHint) {
    instructions.push(placementHint);
  }
  const targetInstruction = createEventTargetInstruction({
    targetName,
    isSelf,
    wasTagged,
    hadTag,
  });
  if (targetInstruction) {
    instructions.push(targetInstruction);
  }
  instructions.push(
    [
      'Учитывай дополнительный пользовательский текст (может отсутствовать).',
      extraText
        ? `Текст: "${extraText}". Постарайся обыграть его.`
        : 'Дополнительный текст отсутствует.',
    ].join(' ')
  );
  if (mentionCandidates.length) {
    instructions.push(
      `среди зрителей сейчас: ${mentionCandidates
        .map((name) => `@${name}`)
        .join(', ')} — они остаются фоном и не становятся объектом поцелуя, главным остаётся выбранный ботом партнёр`
    );
  } else {
    instructions.push(
      'Имея один шанс из трёх, можешь добавить случайного зрителя или зрителей, используя переменные [random_chatter] — бот подставит имена, но добавленные зрители не должны быть главным объектом поцелуя, лишь частью обстановки.'
    );
  }
  instructions.push(
    'Для случайных чисел можно использовать переменные [от (минимальное число) до (максимальное число)] — например, $randomnumber2:5'
  );
  instructions.push('Фраза должна состоять из одной короткой конструкции.');

  const messages = [
    {
      role: 'system',
      content: POCELUY_VARIANT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        'Придумай новое обстоятельство для шуточного шаблонного ответа:`Пользователь1 [место для обстоятельства] поцелует что-то пользователя2`. Обстоятельство обязано подходит в смысловом плане под это шаблонное предложение. Не нужно использовать данное шаблонное предложение при формировании обстоятельства и упоминать пользователя1 и пользователя2 и напрямую место поцелуя',
        instructions.join(' '),
        'Ответ должен быть одной фразой в нижнем регистре без финальной точки. Можно использовать мат',
      ]
        .filter(Boolean)
        .join(' '),
    },
  ];

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 100,
      temperature: 0.8,
      topP: 0.9,
      normalize: normalizeIntimVariant,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error(
      `Failed to fetch Together.ai poceluy variant (${variantLabel})`,
      err
    );
  }

  return fallback || '';
}

async function generatePoceluyVariantTwo(options = {}) {
  return generatePoceluyVariant({
    ...options,
    placementHint:
      'Вставка ставится сразу после инициатора или тега и перед словом «поцелует», опиши обстановку или действие, которое подводит к поцелую.',
    variantLabel: 'two',
  });
}

async function generatePoceluyVariantThree(options = {}) {
  return generatePoceluyVariant({
    ...options,
    placementHint:
      'Эта часть идёт рядом с инициатором или в конце фразы после упоминания партнёра, должна звучать как завершающее обстоятельство сцены.',
    variantLabel: 'three',
  });
}

async function generatePoceluyVariantFour(options = {}) {
  return generatePoceluyVariant({
    ...options,
    placementHint:
      'Эта часть стоит после слова «поцелует» и перед партнёром, опиши способ или место поцелуя без прямых имён.',
    variantLabel: 'four',
  });
}

async function fetchRandomChatterUsername() {
  try {
    const { data, error } = await supabase
      .from('stream_chatters')
      .select('users ( username, twitch_login )');
    if (error) throw error;

    const names = (data || [])
      .map((entry) => {
        const user = entry?.users || {};
        const username =
          typeof user.username === 'string' ? user.username.trim() : '';
        const login =
          typeof user.twitch_login === 'string' ? user.twitch_login.trim() : '';
        return username || login || null;
      })
      .filter(Boolean);

    if (!names.length) {
      return null;
    }

    const idx = Math.floor(Math.random() * names.length);
    return names[idx];
  } catch (err) {
    console.error('Failed to fetch random chatter', err);
    return null;
  }
}

function pickFallbackLocation(exclude = []) {
  if (!WHERE_FALLBACK_LOCATIONS.length) {
    return '';
  }

  const normalizedExclude = exclude.map((loc) => normalizeWhereLocation(loc));
  const available = WHERE_FALLBACK_LOCATIONS.filter((loc) => {
    const normalized = normalizeWhereLocation(loc);
    return normalized && !normalizedExclude.includes(normalized);
  });

  const pool = available.length ? available : WHERE_FALLBACK_LOCATIONS;
  const idx = Math.floor(Math.random() * pool.length);
  return normalizeWhereLocation(pool[idx]);
}

function ensureDistinctWhereLocation(location) {
  const normalized = normalizeWhereLocation(location);
  if (normalized && normalized !== lastWhereLocation) {
    rememberWhereLocation(normalized);
    return normalized;
  }

  const fallback = pickFallbackLocation(lastWhereLocation ? [lastWhereLocation] : []);
  rememberWhereLocation(fallback);
  return fallback;
}

function pickFallbackWhenTime(exclude = []) {
  if (!WHEN_FALLBACK_TIMES.length) {
    return '';
  }

  const normalizedExclude = exclude.map((value) => normalizeWhenTime(value));
  const available = WHEN_FALLBACK_TIMES.filter((value) => {
    const normalized = normalizeWhenTime(value);
    return normalized && !normalizedExclude.includes(normalized);
  });

  const pool = available.length ? available : WHEN_FALLBACK_TIMES;
  const idx = Math.floor(Math.random() * pool.length);
  return normalizeWhenTime(pool[idx]);
}

function ensureDistinctWhenTime(time) {
  const normalized = normalizeWhenTime(time);
  if (normalized && normalized !== lastWhenTime) {
    rememberWhenTime(normalized);
    return normalized;
  }

  const fallback = pickFallbackWhenTime(lastWhenTime ? [lastWhenTime] : []);
  rememberWhenTime(fallback);
  return fallback;
}

function pickFallbackWhereToDestination(exclude = []) {
  if (!WHERETO_FALLBACK_DESTINATIONS.length) {
    return '';
  }

  const normalizedExclude = exclude.map((value) =>
    normalizeWhereToDestination(value)
  );
  const available = WHERETO_FALLBACK_DESTINATIONS.filter((value) => {
    const normalized = normalizeWhereToDestination(value);
    return normalized && !normalizedExclude.includes(normalized);
  });

  const pool = available.length ? available : WHERETO_FALLBACK_DESTINATIONS;
  const idx = Math.floor(Math.random() * pool.length);
  return normalizeWhereToDestination(pool[idx]);
}

function ensureDistinctWhereToDestination(destination) {
  const normalized = normalizeWhereToDestination(destination);
  if (normalized && normalized !== lastWhereToDestination) {
    rememberWhereToDestination(normalized);
    return normalized;
  }

  const fallback = pickFallbackWhereToDestination(
    lastWhereToDestination ? [lastWhereToDestination] : []
  );
  rememberWhereToDestination(fallback);
  return fallback;
}

function pickFallbackWhatAction(exclude = []) {
  if (!WHAT_FALLBACK_ACTIONS.length) {
    return '';
  }

  const normalizedExclude = exclude.map((value) => normalizeWhatAction(value));
  const available = WHAT_FALLBACK_ACTIONS.filter((value) => {
    const normalized = normalizeWhatAction(value);
    return normalized && !normalizedExclude.includes(normalized);
  });

  const pool = available.length ? available : WHAT_FALLBACK_ACTIONS;
  const idx = Math.floor(Math.random() * pool.length);
  return normalizeWhatAction(pool[idx]);
}

function ensureDistinctWhatAction(action) {
  const normalized = normalizeWhatAction(action);
  if (normalized && normalized !== lastWhatAction) {
    rememberWhatAction(normalized);
    return normalized;
  }

  const fallback = pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
  rememberWhatAction(fallback);
  return fallback;
}

async function generateWhereLocation(subjectText) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return pickFallbackLocation(
      lastWhereLocation ? [lastWhereLocation] : []
    );
  }

  const mentionCandidates = await fetchWhereMentionCandidates(subjectText);
  const mentionInstruction = mentionCandidates.length
    ? [
        `Среди зрителей сейчас: ${mentionCandidates
          .map((name) => `@${name}`)
          .join(', ')}.`,
        'Имея один шанс из трёх, добавляй упоминание одного из них, если это делает локацию смешнее, например "в гостях у @имя" или "на тусовке с @имя".',
        `Не упоминай ${subjectText}.`,
      ].join(' ')
    : '';

  const messages = [
    {
      role: 'system',
      content: WHERE_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content:
        `Ответь только неожиданным и забавным местом для ${subjectText}. Ответ должен соответсвовать вопросу "где?"` +
        mentionInstruction +
        `Не добавляй пояснений и знаков препинания. $whereuser=${subjectText}. Можно использовать мат.`,
    },
  ];

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 100,
      temperature: 0.8,
      topP: 0.9,
      normalize: normalizeWhereLocation,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error('Failed to fetch Together.ai location', err);
  }

  return pickFallbackLocation(lastWhereLocation ? [lastWhereLocation] : []);
}

async function generateWhenTime(subjectText) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return pickFallbackWhenTime(lastWhenTime ? [lastWhenTime] : []);
  }

  const previousTimeInstruction = lastWhenTime
    ? `Предыдущий ответ: ${lastWhenTime}. Не повторяй его. `
    : '';
  const messages = [
    {
      role: 'system',
      content: WHEN_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content:
        `Ответь забавным временем для ${subjectText}. Ответ должен соответсвовать вопросу "когда?"` +
        'Не добавляй пояснений и знаков препинания. Можно использовать мат.' +
        `Не повторяй имя ${subjectText}. $whenuser=${subjectText}`,
    },
  ];

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 100,
      temperature: 0.8,
      topP: 0.9,
      normalize: normalizeWhenTime,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error('Failed to fetch Together.ai time', err);
  }

  return pickFallbackWhenTime(lastWhenTime ? [lastWhenTime] : []);
}

async function generateWhereToDestination(subjectText) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return pickFallbackWhereToDestination(
      lastWhereToDestination ? [lastWhereToDestination] : []
    );
  }

  const mentionCandidates = await fetchWhereMentionCandidates(subjectText);
  const mentionInstruction = mentionCandidates.length
    ? [
        `Среди зрителей сейчас: ${mentionCandidates
          .map((name) => `@${name}`)
          .join(', ')}.`,
        'Имея один шанс из трёх, добавляй упоминание одного из них, если это делает направление смешнее',
        `Не упоминай ${subjectText}.`,
      ].join(' ')
    : '';

  const messages = [
    {
      role: 'system',
      content: WHERETO_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content:
        `Ответь только неожиданным направлением или пунктом назначения для ${subjectText}. Можно использовать мат.` +
        mentionInstruction +
        `Фраза должна быть забавной и не начинаться с глагола. Избегай повторов. Ответ должен соответсвовать вопросу "куда?" $wheretouser=${subjectText}`,
    },
  ];

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 100,
      temperature: 0.8,
      topP: 0.9,
      normalize: normalizeWhereToDestination,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error('Failed to generate where-to destination', err);
    return pickFallbackWhereToDestination(
      lastWhereToDestination ? [lastWhereToDestination] : []
    );
  }

  return pickFallbackWhereToDestination(
    lastWhereToDestination ? [lastWhereToDestination] : []
  );
}

async function generateWhatAction(subjectText) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
  }

  const mentionCandidates = await fetchWhereMentionCandidates(subjectText);
  const mentionInstruction = mentionCandidates.length
    ? [
        `Среди зрителей сейчас: ${mentionCandidates
          .map((name) => `@${name}`)
          .join(', ')}.`,
        'Имея один шанс из трёх, добавляй упоминание одного из них, если это делает действие смешнее.',
        `Не упоминай ${subjectText}.`,
      ].join(' ')
    : '';

  const messages = [
    {
      role: 'system',
      content: WHAT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content:
        `Ответь только предметом или явлением. Можно использовать мат.` +
        mentionInstruction +
        `Фраза должна быть забавной, не начинаться с глагола и оставаться в нижнем регистре. Ответ должен соответсвовать вопросу "что?" Избегай повторов. $whatuser=${subjectText}`,
    },
  ];

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 100,
      temperature: 0.8,
      topP: 0.9,
      normalize: normalizeWhatAction,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error('Failed to fetch Together.ai activity', err);
    return pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
  }

  return pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
}

async function generateHornypapsReply({
  username = '',
  role = 'user',
  message = '',
  history = [],
} = {}) {
  const apiKey = (process.env.TOGETHER_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  const normalizedHistory = Array.isArray(history) ? history : [];
  const formattedHistory = normalizedHistory
    .filter((entry) => entry && entry.message)
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: `${entry.username || 'user'}: ${entry.message}`,
    }));

  const lastEntry = normalizedHistory[normalizedHistory.length - 1];
  const shouldAppendPrompt = !(
    lastEntry &&
    lastEntry.message === message &&
    normalizeUsername(lastEntry.username) === normalizeUsername(username)
  );

  const messages = [
    {
      role: 'system',
      content: HORNYPAPS_SYSTEM_PROMPT,
    },
    ...formattedHistory,
  ];

  if (shouldAppendPrompt) {
    messages.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      content: `${username || 'user'}: ${message}`,
    });
  }

  try {
    const result = await requestTogetherChat({
      messages,
      maxTokens: 120,
      temperature: 0.85,
      topP: 0.9,
      normalize: normalizeHornypapsReply,
    });

    if (result?.text) {
      return result.text;
    }
  } catch (err) {
    console.error('Failed to fetch Together.ai Hornypaps reply', err);
  }

  return null;
}

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
  updateSubMonths(TWITCH_CHANNEL).catch((err) =>
    console.error('Initial sub check failed', err)
  );
}

let rewardIds = LOG_REWARD_IDS
  ? LOG_REWARD_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

if (!MUSIC_REWARD_ID) {
  console.warn('MUSIC_REWARD_ID not set');
}

const {
  intim: INTIM_COLUMNS,
  poceluy: POCELUY_COLUMNS,
} = require('../shared/intimPoceluyTypes.json');

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
let donationTokenMissingWarned = false;
let donationTokenErrorWarned = false;

async function getDonationAlertsToken() {
  if (donationToken && donationExpiry - 60 > Math.floor(Date.now() / 1000)) {
    return donationToken;
  }
  try {
    const { data, error } = await supabase
      .from('donationalerts_tokens')
      .select('access_token, expires_at')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || !data.access_token) {
      donationToken = null;
      donationExpiry = 0;
      if (!donationTokenMissingWarned) {
        console.warn('Donation Alerts token not found');
        donationTokenMissingWarned = true;
      }
      return null;
    }

    donationToken = data.access_token;
    donationExpiry = data.expires_at
      ? Math.floor(new Date(data.expires_at).getTime() / 1000)
      : 0;
    donationTokenMissingWarned = false;
    donationTokenErrorWarned = false;
    return donationToken;
  } catch (err) {
    donationToken = null;
    donationExpiry = 0;
    if (!donationTokenErrorWarned) {
      console.warn('Failed to load Donation Alerts token', err);
      donationTokenErrorWarned = true;
    }
    return null;
  }
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

  const shouldTriggerObs =
    Boolean(type) && /^(intim|poceluy)_/.test(type) && obsClient.isConfigured();
  if (shouldTriggerObs) {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('obs_media')
          .select('gif_url, sound_url')
          .eq('type', type);
        if (error) {
          throw error;
        }
        if (!Array.isArray(data) || data.length === 0) {
          return;
        }
        const selected = data[Math.floor(Math.random() * data.length)];
        if (!selected) return;
        await obsClient.updateMediaInputs({
          gifUrl: selected.gif_url || null,
          soundUrl: selected.sound_url || null,
        });
      } catch (err) {
        console.error(`Failed to process OBS media for type ${type}`, err);
      }
    })();
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

async function loadLastDonationId() {
  try {
    let query = supabase.from && supabase.from('event_logs');
    if (!query || typeof query.select !== 'function') {
      return;
    }
    query = query.select('title');
    if (!query || typeof query.eq !== 'function') {
      return;
    }
    query = query.eq('type', 'donation');
    if (!query || typeof query.order !== 'function') {
      return;
    }
    query = query.order('created_at', { ascending: false });
    if (!query || typeof query.limit !== 'function') {
      return;
    }
    query = query.limit(1);
    if (!query || typeof query.maybeSingle !== 'function') {
      return;
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data && data.title) {
      const parsed = parseInt(data.title, 10);
      if (!Number.isNaN(parsed)) {
        lastDonationId = parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load last donation id', err);
  }
}

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

    // Ensure deterministic order and correct cursor handling
    donations.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    let processedMaxId = lastDonationId;
    for (const d of donations) {
      if (!d || typeof d.id !== 'number') continue;
      if (d.id <= lastDonationId) continue;
      processedMaxId = Math.max(processedMaxId, d.id);
      const name = d.username || d.name || 'Anonymous';
      const amount = `${d.amount}${d.currency ? ' ' + d.currency : ''}`;
      const msg = `Donation from ${name}: ${amount}`;
      const mediaUrl = d.media?.url || null;
      let previewUrl = null;
      if (mediaUrl && (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))) {
        previewUrl = getYoutubeThumbnail(mediaUrl);
      }
      await logEvent(msg, mediaUrl, previewUrl, String(d.id), 'donation');
    }
    lastDonationId = processedMaxId;
  } catch (err) {
    console.error('Donation check failed', err);
  }
}

loadLastDonationId().finally(() => {
  checkDonations();
  setInterval(checkDonations, 10000);
});

const joinedThisStream = new Set();
let streamOnline = null;
let firstMessageAchieved = false;
let firstMessageUserId = null;

async function checkStreamStatus() {
  if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID) return;
  try {
    let token = null;
    if (TWITCH_SECRET) {
      try {
        token = await getTwitchToken();
      } catch (err) {
        console.error('App token fetch failed, trying streamer token', err);
      }
    }
    if (!token) {
      token = await getStreamerToken();
    }
    if (!token) return;
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
    const wasOnline = streamOnline;
    streamOnline = online;
    if (wasOnline === null) {
      if (!online) {
        return;
      }
      try {
        const { data: chatters, error } = await supabase
          .from('stream_chatters')
          .select('user_id');
        if (error) throw error;
        if (!Array.isArray(chatters) || chatters.length === 0) {
          joinedThisStream.clear();
          firstMessageAchieved = false;
          firstMessageUserId = null;
          await supabase.from('stream_chatters').delete().neq('user_id', 0);
        }
      } catch (err) {
        console.error('Stream chatter preservation check failed', err);
      }
      return;
    }
    if (wasOnline === true && !online) {
      joinedThisStream.clear();
      firstMessageAchieved = false;
      firstMessageUserId = null;
      await supabase.from('stream_chatters').delete().neq('user_id', 0);
    } else if (wasOnline === false && online) {
      joinedThisStream.clear();
      firstMessageAchieved = false;
      firstMessageUserId = null;
      await supabase.from('stream_chatters').delete().neq('user_id', 0);
    }
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
  const normalizeUsername = (value = '') => value.trim().toLowerCase();
  const rawUsername = typeof tags.username === 'string' ? tags.username : '';
  const normalizedLogin = normalizeUsername(rawUsername);
  const displayName =
    (typeof tags['display-name'] === 'string' && tags['display-name'].trim()) ||
    (rawUsername && rawUsername.trim()) ||
    '';
  const username = displayName || normalizedLogin || `user_${Date.now()}`;
  const normalizedUsername = normalizeUsername(username);

  let user = null;

  if (normalizedLogin) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('twitch_login', normalizedLogin)
      .maybeSingle();
    if (error) throw error;
    user = data;
  }

  if (!user) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', normalizedUsername)
      .maybeSingle();
    if (error) throw error;
    user = data;
  }

  if (user) {
    if (normalizedLogin && user.twitch_login !== normalizedLogin) {
      const { data: updatedUser, error: updateErr } = await supabase
        .from('users')
        .update({ twitch_login: normalizedLogin })
        .eq('id', user.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      user = updatedUser;
    }
    return user;
  }

  const res = await supabase
    .from('users')
    .insert({ username, twitch_login: normalizedLogin || null })
    .select()
    .single();
  if (res.error) {
    if (res.error.code === '23505') {
      const fetchExisting = async () => {
        const { data: byLogin, error: loginErr } = normalizedLogin
          ? await supabase
              .from('users')
              .select('*')
              .ilike('twitch_login', normalizedLogin)
              .maybeSingle()
          : { data: null, error: null };
        if (loginErr) throw loginErr;
        if (byLogin) return byLogin;

        const { data: byUsername, error: usernameErr } = await supabase
          .from('users')
          .select('*')
          .ilike('username', normalizedUsername)
          .maybeSingle();
        if (usernameErr) throw usernameErr;
        return byUsername;
      };

      const existingUser = await fetchExisting();
      if (existingUser) {
        if (normalizedLogin && existingUser.twitch_login !== normalizedLogin) {
          const { data: updated, error: updateErr } = await supabase
            .from('users')
            .update({ twitch_login: normalizedLogin })
            .eq('id', existingUser.id)
            .select()
            .single();
          if (updateErr) throw updateErr;
          return updated;
        }
        return existingUser;
      }
    }
    throw res.error;
  }

  return res.data;
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
  if (
    cachedAcceptVotes !== null &&
    Date.now() - acceptVotesFetchedAt < ACCEPT_VOTES_TTL_MS
  ) {
    return cachedAcceptVotes;
  }

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'accept_votes')
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch accept_votes', error);
    return cachedAcceptVotes ?? true;
  }

  const enabled = !data || Number(data.value) !== 0;
  cachedAcceptVotes = enabled;
  acceptVotesFetchedAt = Date.now();
  return enabled;
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

async function applyRandomPlaceholders(text, supabase, exclude = new Set()) {
  if (!text) return text;
  let result = text.replace(/\[от\s*(\d+)\s*до\s*(\d+)\]/gi, (_m, a, b) => {
    let min = parseInt(a, 10);
    let max = parseInt(b, 10);
    if (Number.isNaN(min) || Number.isNaN(max)) return _m;
    if (min > max) [min, max] = [max, min];
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  });

  if (/\[random_chatter\]/i.test(result)) {
    try {
      const { data, error } = await supabase
        .from('stream_chatters')
        .select('users ( username )');
      if (error) throw error;
      let names = (data || []).map((c) => c.users.username);
      names = names.filter((n) => !exclude.has(n.toLowerCase()));
      result = result.replace(/\[random_chatter\]/gi, () => {
        if (names.length === 0) return '';
        const idx = Math.floor(Math.random() * names.length);
        const name = names.splice(idx, 1)[0];
        exclude.add(name.toLowerCase());
        return `@${name}`;
      });
    } catch (err) {
      console.error('random chatter fetch failed', err);
      result = result.replace(/\[random_chatter\]/gi, '');
    }
  }

  result = result.replace(/\$randomnumber([0-9:]+)/gi, (_match, range) => {
    if (!range) return _match;
    const parts = range.split(':').map((value) => parseInt(value, 10));
    let min = 1;
    let max = null;
    if (parts.length === 1) {
      max = parts[0];
    } else if (parts.length >= 2) {
      [min, max] = parts;
    }
    if (Number.isNaN(min) || Number.isNaN(max) || max === null) {
      return _match;
    }
    if (min > max) {
      [min, max] = [max, min];
    }
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    return String(value);
  });

  if (/\$intimuser\d*/i.test(result)) {
    try {
      const { data, error } = await supabase
        .from('stream_chatters')
        .select('users ( username )');
      if (error) throw error;
      let names = (data || [])
        .map((entry) => entry?.users?.username)
        .filter(Boolean)
        .map((name) => name.toString().trim())
        .filter((name) => name)
        .filter((name, idx, arr) => {
          const normalized = normalizeUsername(name);
          if (!normalized || exclude.has(normalized)) {
            return false;
          }
          const firstIdx = arr.findIndex(
            (candidate) => normalizeUsername(candidate) === normalized
          );
          return firstIdx === idx;
        });

      const placeholders = Array.from(
        new Set(
          (result.match(/\$intimuser\d*/gi) || []).map((placeholder) =>
            placeholder.toLowerCase()
          )
        )
      );

      const replacements = new Map();
      for (const placeholder of placeholders) {
        if (!names.length) {
          replacements.set(placeholder, '');
          continue;
        }
        const idx = Math.floor(Math.random() * names.length);
        const [name] = names.splice(idx, 1);
        replacements.set(placeholder, `@${name}`);
        exclude.add(normalizeUsername(name));
      }

      result = result.replace(/\$intimuser\d*/gi, (match) => {
        const key = match.toLowerCase();
        return replacements.get(key) || '';
      });
    } catch (err) {
      console.error('intimuser placeholder fetch failed', err);
      result = result.replace(/\$intimuser\d*/gi, '');
    }
  }

  return result;
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
    if (streamOnline && tags.username.toLowerCase() !== 'hornypaps') {
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

  const trimmedMessage = message.trim();
  addChatHistory({
    username: tags.username,
    role: 'user',
    message: trimmedMessage,
  });

  if (/@hornypaps\b/i.test(trimmedMessage)) {
    const now = Date.now();
    if (now - lastHornypapsReplyAt >= HORNY_PAPS_THROTTLE_MS) {
      lastHornypapsReplyAt = now;
      let reply = null;
      try {
        reply = await generateHornypapsReply({
          username: tags.username,
          role: 'user',
          message: trimmedMessage,
          history: getChatHistorySnapshot(),
        });
      } catch (err) {
        console.error('Hornypaps reply generation failed', err);
      }

      if (!reply) {
        reply = HORNYPAPS_FALLBACK_REPLY;
      }

      try {
        const actionId = getChatActionId('hornypapsReply');
        if (actionId) {
          await streamerBot.triggerAction(actionId, {
            message: reply,
            initiator: tags.username,
            type: 'hornypaps',
          });
        } else {
          await client.say(channel, reply);
        }
        addChatHistory({
          username: 'hornypaps',
          role: 'assistant',
          message: reply,
        });
      } catch (err) {
        console.error('Hornypaps reply send failed', err);
      }
    }
    return;
  }

  const loweredMsg = trimmedMessage.toLowerCase();
  if (loweredMsg.startsWith('!где')) {
    const subjectInput = message.trim().slice(4).trim();
    const subject = subjectInput || `@${tags.username}`;
    let location;
    try {
      location = await generateWhereLocation(subject);
    } catch (err) {
      console.error('!где command failed to generate location', err);
      location = pickFallbackLocation();
    }

    location = ensureDistinctWhereLocation(location);

    const resultMessage = `${subject} ${location}`.trim();

    try {
      await sendChatMessage('whereResult', {
        message: resultMessage,
        initiator: tags.username,
        type: 'where',
      });
    } catch (err) {
      console.error('!где command failed to send result', err);
    }

    return;
  }
  if (loweredMsg.startsWith('!когда')) {
    const command = '!когда';
    const subjectInput = message.trim().slice(command.length).trim();
    const subject = subjectInput || `@${tags.username}`;
    let time;
    try {
      time = await generateWhenTime(subject);
    } catch (err) {
      console.error('!когда command failed to generate time', err);
      time = pickFallbackWhenTime();
    }

    time = ensureDistinctWhenTime(time);

    const resultMessage = `${subject} ${time}`.trim();

    try {
      await sendChatMessage('whenResult', {
        message: resultMessage,
        initiator: tags.username,
        type: 'when',
      });
    } catch (err) {
      console.error('!когда command failed to send result', err);
    }

    return;
  }
  if (loweredMsg.startsWith('!что')) {
    const command = '!что';
    const subjectInput = message.trim().slice(command.length).trim();
    const subject = subjectInput || `@${tags.username}`;
    let action;
    try {
      action = await generateWhatAction(subject);
    } catch (err) {
      console.error('!что command failed to generate activity', err);
      action = pickFallbackWhatAction();
    }

    action = ensureDistinctWhatAction(action);

    const resultMessage = `${subject} ${action}`.trim();

    try {
      await sendChatMessage('whatResult', {
        message: resultMessage,
        initiator: tags.username,
        type: 'what',
      });
    } catch (err) {
      console.error('!что command failed to send result', err);
    }

    return;
  }
  if (loweredMsg.startsWith('!куда')) {
    const command = '!куда';
    const subjectInput = message.trim().slice(command.length).trim();
    const subject = subjectInput || `@${tags.username}`;
    let destination;
    try {
      destination = await generateWhereToDestination(subject);
    } catch (err) {
      console.error('!куда command failed to generate direction', err);
      destination = pickFallbackWhereToDestination();
    }

    destination = ensureDistinctWhereToDestination(destination);

    const resultMessage = `${subject} ${destination}`.trim();

    try {
      await sendChatMessage('whereToResult', {
        message: resultMessage,
        initiator: tags.username,
        type: 'whereTo',
      });
    } catch (err) {
      console.error('!куда command failed to send result', err);
    }

    return;
  }
  if (loweredMsg.startsWith('!кто')) {
    const command = '!кто';
    const subject = message.trim().slice(command.length).trim();
    let randomUsername = await fetchRandomChatterUsername();
    if (!randomUsername) {
      randomUsername = tags?.username || null;
    }

    const mention = randomUsername ? `@${randomUsername}` : null;
    const parts = [];
    if (subject) {
      parts.push(subject);
    }
    if (mention) {
      parts.push(mention);
    }

    const resultMessage = parts.join(' ').trim();
    if (!resultMessage) {
      return;
    }

    try {
      await sendChatMessage('whoResult', {
        message: resultMessage,
        initiator: tags.username,
        type: 'who',
      });
    } catch (err) {
      console.error('!кто command failed to send result', err);
    }

    return;
  }
  if (loweredMsg === '!clip') {
    try {
      if (!TWITCH_CHANNEL_ID || !TWITCH_CLIENT_ID) {
        await sendChatMessage('clipError', {
          message: `@${tags.username}, не удалось создать клип.`,
          initiator: tags.username,
          type: 'error',
        });
        return;
      }
      const token = await getStreamerToken();
      if (!token) {
        await sendChatMessage('clipError', {
          message: `@${tags.username}, не удалось создать клип.`,
          initiator: tags.username,
          type: 'error',
        });
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
        await sendChatMessage('clipError', {
          message: `@${tags.username}, не удалось создать клип.`,
          initiator: tags.username,
          type: 'error',
        });
        return;
      }
      const data = await resp.json();
      const clipId = data?.data?.[0]?.id;
      if (clipId) {
        await sendChatMessage('clipSuccess', {
          message: `@${tags.username}, клип создан: https://clips.twitch.tv/${clipId}`,
          initiator: tags.username,
          type: 'success',
        });
        await incrementUserStat(user.id, 'clips_created');
      } else {
        await sendChatMessage('clipError', {
          message: `@${tags.username}, не удалось создать клип.`,
          initiator: tags.username,
          type: 'error',
        });
      }
    } catch (err) {
      console.error('clip creation failed', err);
      await sendChatMessage('clipError', {
        message: `@${tags.username}, не удалось создать клип.`,
        initiator: tags.username,
        type: 'error',
      });
    }
    return;
  }
  if (loweredMsg.startsWith('!интим')) {
    const args = message.trim().split(/\s+/).slice(1);
    const tagArg = args.find((a) => a.startsWith('@'));
    const hasTag = Boolean(tagArg);
    const normalizedTag = hasTag
      ? tagArg.replace(/^@/, '').toLowerCase()
      : null;
    const extraText = args.filter((a) => !a.startsWith('@')).join(' ');
    let partnerUser = null;
    let taggedUser = null;
    let chatters = [];

    const now = Date.now();
    const entry = lastCommandTimes.get(user.id) || { intim: 0, poceluy: 0 };
    if (now - entry.poceluy <= 60000) {
      await incrementUserStat(user.id, 'combo_commands');
    }
    entry.intim = now;
    lastCommandTimes.set(user.id, entry);

    try {
      const { data: chattersData, error } = await supabase
        .from('stream_chatters')
        .select('user_id, users ( username )');
      if (error) throw error;
      chatters = chattersData || [];
      if (!chatters || chatters.length === 0) {
        await sendChatMessage('intimNoParticipants', {
          message: `@${tags.username}, сейчас нет других участников.`,
          initiator: tags.username,
          type: 'no_participants',
        });
        return;
      }
      const random = chatters[Math.floor(Math.random() * chatters.length)];
      partnerUser = { id: random.user_id, username: random.users.username };
    } catch (err) {
      console.error('select random chatter failed', err);
      return;
    }

    if (normalizedTag) {
      try {
        const { data: tUser, error: tErr } = await supabase
          .from('users')
          .select('id, username')
          .eq('twitch_login', normalizedTag)
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
      const hadTag = hasTag;
      const tagMatchesPartner =
        Boolean(taggedUser) && taggedUser.id === partnerUser?.id;
      const targetName = normalizedTag || partnerUser?.username || '';
      const isSelfTarget = partnerUser?.id === user.id;
      const wasTagged = tagMatchesPartner;
      const variantOneRaw = await generateIntimVariantOne({
        fallback: context.variant_one || '',
        authorName: tags.username,
        partnerName: partnerUser.username,
        chatters,
        extraText,
        targetName,
        isSelf: isSelfTarget,
        wasTagged,
        hadTag,
      });
      let variantOne = variantOneRaw || context.variant_one || '';
      let variantTwo = context.variant_two || '';
      const excludeNames = new Set([
        tags.username.toLowerCase(),
        partnerUser.username.toLowerCase(),
      ]);
      variantOne = await applyRandomPlaceholders(
        variantOne,
        supabase,
        excludeNames
      );
      variantTwo = await applyRandomPlaceholders(
        variantTwo,
        supabase,
        excludeNames
      );
      const percent = Math.floor(Math.random() * 101);
      const isSelf = partnerUser.id === user.id;
      const partnerMatchesTag =
        Boolean(normalizedTag) &&
        normalizedTag === partnerUser.username.toLowerCase();
      const columnsBefore = [];
      let mainColumn = null;
      if (isSelf) {
        const col = `intim_self_${hasTag ? 'with_tag' : 'no_tag'}`;
        columnsBefore.push(col);
        mainColumn = col;
      }
      if (partnerMatchesTag) {
        columnsBefore.push('intim_tagged_equals_partner');
        columnsBefore.push('intim_tag_match_success');
        if (!mainColumn) mainColumn = 'intim_tagged_equals_partner';
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
      const partnerName = `@${partnerUser.username}`;
      if (percentSpecial) {
        const columns = [];
        const suffix = String(percent);
        const tagType = hasTag ? 'with_tag' : 'no_tag';
        const baseCol = `intim_${tagType}_${suffix}`;
        columns.push(baseCol);
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
        mainColumn = baseCol;
      }
      const text = hasTag
        ? `${percent}% шанс того, что ${authorName} ${variantTwo} ${tagArg} интимиться с ${partnerName} ${variantOne}`
        : `${percent}% шанс того, что у ${authorName} ${variantOne} будет интим с ${partnerName}`;
      const streamerBotType = mainColumn || 'обычные';
      await sendChatMessage('intimResult', {
        message: text,
        initiator: tags.username,
        target: partnerUser?.username ?? null,
        type: streamerBotType,
      });
      if (mainColumn) {
        await logEvent(text, null, null, null, mainColumn);
      }
      await streamerBot.triggerIntim({
        type: streamerBotType,
        initiator: tags.username,
        target: partnerUser?.username ?? null,
        message: text,
      });
    } catch (err) {
      console.error('intim command failed', err);
    }
    return;
  }

  if (loweredMsg.startsWith('!поцелуй')) {
    const args = message.trim().split(/\s+/).slice(1);
    const tagArg = args.find((a) => a.startsWith('@'));
    const hasTag = Boolean(tagArg);
    const normalizedTag = hasTag
      ? tagArg.replace(/^@/, '').toLowerCase()
      : null;
    const extraText = args.filter((a) => !a.startsWith('@')).join(' ');
    let partnerUser = null;
    let taggedUser = null;
    let chatters = [];

    const now = Date.now();
    const entry = lastCommandTimes.get(user.id) || { intim: 0, poceluy: 0 };
    if (now - entry.intim <= 60000) {
      await incrementUserStat(user.id, 'combo_commands');
    }
    entry.poceluy = now;
    lastCommandTimes.set(user.id, entry);

    try {
      const { data: chattersData, error } = await supabase
        .from('stream_chatters')
        .select('user_id, users ( username )');
      if (error) throw error;
      chatters = chattersData || [];
      if (!chatters || chatters.length === 0) {
        await sendChatMessage('poceluyNoParticipants', {
          message: `@${tags.username}, сейчас нет других участников.`,
          initiator: tags.username,
          type: 'no_participants',
        });
        return;
      }
      const random = chatters[Math.floor(Math.random() * chatters.length)];
      partnerUser = { id: random.user_id, username: random.users.username };
    } catch (err) {
      console.error('select random chatter failed', err);
      return;
    }

    if (normalizedTag) {
      try {
        const { data: tUser, error: tErr } = await supabase
          .from('users')
          .select('id, username')
          .eq('twitch_login', normalizedTag)
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
        .select('variant_two, variant_three, variant_four');
      if (ctxErr || !contexts || contexts.length === 0) throw ctxErr;
      const context =
        contexts[Math.floor(Math.random() * contexts.length)] || {};
      const hadTag = hasTag;
      const tagMatchesPartner =
        Boolean(taggedUser) && taggedUser.id === partnerUser?.id;
      const targetName = normalizedTag || partnerUser?.username || '';
      const isSelfTarget = partnerUser?.id === user.id;
      const wasTagged = tagMatchesPartner;
      const variantTwoRaw = await generatePoceluyVariantTwo({
        fallback: context.variant_two || '',
        authorName: tags.username,
        partnerName: partnerUser.username,
        chatters,
        extraText,
        targetName,
        isSelf: isSelfTarget,
        wasTagged,
        hadTag,
      });
      const variantThreeRaw = await generatePoceluyVariantThree({
        fallback: context.variant_three || '',
        authorName: tags.username,
        partnerName: partnerUser.username,
        chatters,
        extraText,
        targetName,
        isSelf: isSelfTarget,
        wasTagged,
        hadTag,
      });
      const variantFourRaw = await generatePoceluyVariantFour({
        fallback: context.variant_four || '',
        authorName: tags.username,
        partnerName: partnerUser.username,
        chatters,
        extraText,
        targetName,
        isSelf: isSelfTarget,
        wasTagged,
        hadTag,
      });
      let variantTwo = variantTwoRaw || context.variant_two || '';
      let variantThree = variantThreeRaw || context.variant_three || '';
      let variantFour = variantFourRaw || context.variant_four || '';
      const excludeNames = new Set([
        tags.username.toLowerCase(),
        partnerUser.username.toLowerCase(),
      ]);
      variantTwo = await applyRandomPlaceholders(
        variantTwo,
        supabase,
        excludeNames
      );
      variantThree = await applyRandomPlaceholders(
        variantThree,
        supabase,
        excludeNames
      );
      variantFour = await applyRandomPlaceholders(
        variantFour,
        supabase,
        excludeNames
      );
      const percent = Math.floor(Math.random() * 101);
      const isSelf = partnerUser.id === user.id;
      const partnerMatchesTag =
        Boolean(normalizedTag) &&
        normalizedTag === partnerUser.username.toLowerCase();
      const columnsBefore = [];
      let mainColumn = null;
      if (isSelf) {
        const col = `poceluy_self_${hasTag ? 'with_tag' : 'no_tag'}`;
        columnsBefore.push(col);
        mainColumn = col;
      }
      if (partnerMatchesTag) {
        columnsBefore.push('poceluy_tagged_equals_partner');
        columnsBefore.push('poceluy_tag_match_success');
        if (!mainColumn) mainColumn = 'poceluy_tagged_equals_partner';
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
      const partnerName = `@${partnerUser.username}`;
      if (percentSpecial) {
        const columns = [];
        const suffix = String(percent);
        const tagType = hasTag ? 'with_tag' : 'no_tag';
        const baseCol = `poceluy_${tagType}_${suffix}`;
        columns.push(baseCol);
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
        mainColumn = baseCol;
      }
      const makePhrase = (...parts) =>
        parts
          .flat()
          .map((part) => (typeof part === 'string' ? part.trim() : part))
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

      const cleanText = hasTag
        ? makePhrase(
            `${percent}% шанс того, что`,
            authorName,
            variantTwo,
            tagArg,
            'поцелует',
            variantFour,
            partnerName,
            variantThree
          )
        : makePhrase(
            `${percent}% шанс того, что`,
            'у',
            authorName,
            variantThree,
            'поцелует',
            variantFour,
            partnerName
          );
      const streamerBotType = mainColumn || 'обычные';
      await sendChatMessage('poceluyResult', {
        message: cleanText,
        initiator: tags.username,
        target: partnerUser?.username ?? null,
        type: streamerBotType,
      });
      if (mainColumn) {
        await logEvent(cleanText, null, null, null, mainColumn);
      }
      await streamerBot.triggerPoceluy({
        type: streamerBotType,
        initiator: tags.username,
        target: partnerUser?.username ?? null,
        message: cleanText,
      });
    } catch (err) {
      console.error('poceluy command failed', err);
    }
    return;
  }

  const EXTRA_VOTE_REWARD_ID = 'e776c465-7f7a-4a41-8593-68165248ecd8';
  const rewardId = tags['custom-reward-id'];
  if (rewardId === EXTRA_VOTE_REWARD_ID) {
    try {
      const user = await findOrCreateUser(tags);
      await incrementUserStat(user.id, 'vote_limit', 1);
      await sendChatMessage('rewardExtraVote', {
        message: `@${tags.username}, вам добавлен дополнительный голос.`,
        initiator: tags.username,
        type: 'success',
      });
    } catch (err) {
      console.error('extra vote reward failed', err);
    }
  } else if (MUSIC_REWARD_ID && rewardId === MUSIC_REWARD_ID) {
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
    const name = (await fetchRewardName(rewardId)) || rewardId;
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
      const poll = await getActivePoll();
      if (!poll) {
        await sendChatMessage('pollNoActive', {
          message: `@${tags.username}, сейчас нет активной рулетки.`,
          initiator: tags.username,
          type: 'info',
        });
        return;
      }
      const games = await getGamesForPoll(poll.id);
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
      const poll = await getActivePoll();
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
      let message = `@${tags.username}, у вас осталось ${remaining} голосов.`;
      if (details) {
        message += ` Вы проголосовали за: ${details}.`;
      }
      await sendChatMessage('pollVotesStatus', {
        message,
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
    const poll = await getActivePoll();
    if (!poll) {
      await sendChatMessage('pollNoActive', {
        message: `@${tags.username}, сейчас нет активной рулетки.`,
        initiator: tags.username,
        type: 'info',
      });
      return;
    }

    const votingOpen = await isVotingEnabled();
    if (!votingOpen) {
      await sendChatMessage('pollVotingClosed', {
        message: `@${tags.username}, приём голосов закрыт.`,
        initiator: tags.username,
        type: 'info',
      });
      return;
    }

    const games = await getGamesForPoll(poll.id);
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

    const result = await addVote(user, poll.id, game.id);
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
});

client.on('subscription', async (_channel, username, _methods, msg, tags) => {
  await logEvent(`New sub: ${username}` + (msg ? ` - ${msg}` : ''));
  await updateSubMonths(username, tags);
  try {
    const user = await findOrCreateUser({ ...tags, username });
    await incrementUserStat(user.id, 'total_subs_received');
  } catch (err) {
    console.error('subscription stat update failed', err);
  }
});

client.on('resub', async (_channel, username, _months, msg, tags) => {
  await logEvent(`Re-sub: ${username}` + (msg ? ` - ${msg}` : ''));
  await updateSubMonths(username, tags);
  try {
    const user = await findOrCreateUser({ ...tags, username });
    await incrementUserStat(user.id, 'total_subs_received');
  } catch (err) {
    console.error('resub stat update failed', err);
  }
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
  applyRandomPlaceholders,
};
