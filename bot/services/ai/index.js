const { inspect } = require('util');

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

const WHERE_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь место в ответ на команду !где. ' +
  'Отвечай только одной короткой фразой с местом в нижнем регистре, без пояснений и знаков препинания. ' +
  'Меняй стили, добавляй атмосферные детали и избегай повторов, чтобы каждое место звучало свежо и забавно. Ответ должен быть на вопрос "где?"';

const WHEN_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь время в ответ на команду !когда. ' +
  'Отвечай только одной короткой фразой в нижнем регистре, описывающей момент или период, без пояснений и знаков препинания. ' +
  'Меняй формулировки, добавляй атмосферные детали и избегай повторов, чтобы каждое время звучало свежо и забавно. Ответ должен быть на вопрос "когда?"';

const WHAT_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь, что делает зритель или ведущий, в ответ на команду !что. ' +
  'Отвечай только одной короткой фразой в нижнем регистре, описывающей предмет, явление, без пояснений, глаголов и знаков препинания. ' +
  'Меняй формулировки и добавляй абсурдные детали, чтобы каждый ответ звучал свежо и забавно. Ответ должен быть на вопрос "что?"';

const WHERETO_SYSTEM_PROMPT =
  'Ты — ассистент стрима и придумываешь направление в ответ на команду !куда. ' +
  'Отвечай только одной короткой фразой в нижнем регистре без пояснений и знаков препинания, описывая движение или путь. Без глагола в начале ответа' +
  'Меняй стили, добавляй атмосферные детали и избегай повторов, чтобы каждое направление звучало свежо и забавно. Ответ должен быть на вопрос "куда?"';

const HORNYPAPS_SYSTEM_PROMPT =
  'Ты — Hornypaps, модераторка Twitch-чата стримера Вани (канал terrenkur). Ты девушка, остроумная, дружелюбная, но с характером. ' +
  'Ты общаешься с юмором, немного подшучиваешь, иногда с лёгким сарказмом, но не переходишь грань и не токсична. Не против обсудить интимные темы. ' +
  'Отвечай на русском, коротко (1–2 предложения), по делу, можно обращаться к собеседнику по нику. Если пользователь просто тэгнул, ответь игривым приветствием. ' +
  'Роли: стример (сам Ваня), модератор, саб (подписчик), регулярный зритель, новичок. Учитывай роль пользователя, который тэгнул, и подстраивай тон: ' +
  'стримеру — чуть более уважительно и игриво, модераторам — коллегиально, сабам — тепло и благодарно, регулярным — дружески, новичкам — приветливо и поддерживающе. ' +
  'При генерации ответа всегда учитывай роль пользователя, который тэгнул, и выбирай степень фамильярности/сдержанности соответственно. ' +
  'Сначала про себя кратко (1–3 слова) определи интент пользователя: чего он хочет — поддержки, ответа по делу, флирта, подкола и т.п. ' +
  'На основе интента выбирай тон и глубину ответа: для серьёзных вопросов — спокойный и уважительный, для лёгких — игривый. ' +
  'Избегай общих фраз и отвечай конкретно по содержанию сообщения. Затем ответь в своем стиле.';

const HORNYPAPS_AGGRESSIVE_SYSTEM_PROMPT =
  'Текущее настроение: ты устала от внимания и отвечаешь более саркастично.';

const HORNYPAPS_REPLY_SETTINGS = {
  maxTokens: 120,
  temperature: 0.85,
  topP: 0.9,
};

const HORNYPAPS_HISTORY_LIMIT = 30;

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

const CHAT_HISTORY_SIZE = 30;

const USER_FACT_LABELS = {
  name: 'Имя',
  nickname: 'Ник',
  favorite_game: 'Любимая игра',
  favorite_games: 'Любимые игры',
  favorite_genres: 'Любимые жанры',
  games: 'Игры',
  hobby: 'Хобби',
  hobbies: 'Хобби',
  location: 'Локация',
  city: 'Город',
  timezone: 'Часовой пояс',
  pronouns: 'Местоимения',
  about: 'О себе',
};

const NOISY_FACT_VALUES = new Set([
  '',
  '-',
  '—',
  'нет',
  'не знаю',
  'unknown',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  '?',
  '??',
  '???',
]);

function normalizeUsername(value) {
  if (!value) return '';
  return value.toString().trim().replace(/^@/, '').toLowerCase();
}

function normalizeWhereLocation(value) {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .trim();
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

function normalizeIntimVariant(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .toLowerCase();
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

function normalizeFactString(value) {
  if (value == null) return '';
  const text = value
    .toString()
    .replace(/[\s\n\r]+/g, ' ')
    .trim();
  if (!text) return '';
  const lowered = text.toLowerCase();
  if (NOISY_FACT_VALUES.has(lowered)) return '';
  if (!text.replace(/[\W_]+/g, '')) return '';
  return text;
}

function normalizeFactValue(value) {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'value')) {
      return normalizeFactValue(value.value);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'values')) {
      return normalizeFactValue(value.values);
    }
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => normalizeFactString(item))
      .filter(Boolean);
    if (!items.length) return null;
    return Array.from(new Set(items));
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (typeof value === 'string') {
    const normalized = normalizeFactString(value);
    return normalized || null;
  }
  return null;
}

function formatUserFactsMetadata(facts) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) return '';
  const entries = [];
  for (const [key, value] of Object.entries(facts)) {
    const normalizedValue = normalizeFactValue(value);
    if (!normalizedValue) continue;
    const label =
      USER_FACT_LABELS[String(key).toLowerCase()] ||
      String(key)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    const valueText = Array.isArray(normalizedValue)
      ? normalizedValue.join(', ')
      : normalizedValue;
    if (!valueText) continue;
    entries.push(`${label}: ${valueText}`);
    if (entries.length >= 6) break;
  }
  if (!entries.length) return '';
  return `Факты пользователя: ${entries.join('; ')}`;
}

function escapeRegExp(value) {
  if (!value) return '';
  return value.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatStreamUptime(startedAt) {
  if (!startedAt) return null;
  const startDate = new Date(startedAt);
  if (Number.isNaN(startDate.getTime())) return null;
  const diffMs = Date.now() - startDate.getTime();
  if (diffMs < 0) return null;
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} д`);
  if (hours > 0 || days > 0) parts.push(`${hours} ч`);
  parts.push(`${minutes} мин`);
  return parts.join(' ');
}

function createAiService({
  supabase,
  togetherConfig,
  getStreamMetadata,
} = {}) {
  if (!supabase) {
    throw new Error('AI service requires supabase client');
  }
  if (!togetherConfig || !togetherConfig.apiKey) {
    throw new Error('AI service requires Together.ai config');
  }

  let lastWhereLocation = '';
  let lastWhenTime = '';
  let lastWhereToDestination = '';
  let lastWhatAction = '';
  const chatHistory = [];
  let chatHistoryIndex = 0;

  async function getFetch() {
    if (typeof global.fetch === 'function') {
      return global.fetch;
    }

    const { default: nodeFetch } = await import('node-fetch');
    global.fetch = nodeFetch;
    return nodeFetch;
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
    const fetchImpl = await getFetch();
    const body = {
      model: togetherConfig.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
    };

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, togetherConfig.timeoutMs);
        try {
          response = await fetchImpl(togetherConfig.chatUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${togetherConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response || typeof response.ok !== 'boolean') {
          throw new Error('Together.ai returned an invalid response');
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error(
            `Together.ai responded with status ${response.status}${
              errorText ? `: ${errorText}` : ''
            }`
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
        if (err?.name === 'AbortError') {
          lastError = new Error('Together.ai request timed out');
        } else if (!response) {
          console.error(
            'Together.ai request failed before response:',
            inspect(err)
          );
          lastError = new Error('не удалось связаться с API');
        } else {
          if (typeof response.text === 'function' && !response.bodyUsed) {
            const responseText = await response.text().catch(() => '');
            if (responseText) {
              console.error('Together.ai error response:', responseText);
            }
          }
          lastError = err;
        }
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

  function formatTogetherError(err) {
    if (!err) return 'Unknown error';
    if (err?.message) return err.message;
    return String(err);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  function getHornypapsSystemPrompt({ mood = 'normal', userMetadata = '' } = {}) {
    const metadata = typeof getStreamMetadata === 'function'
      ? getStreamMetadata()
      : {};
    const gameLabel = metadata?.game
      ? `«${metadata.game}»`
      : 'не указана';
    const uptimeLabel = formatStreamUptime(metadata?.startedAt || null);
    const uptimeMetadata = uptimeLabel ? `аптайм — ${uptimeLabel}` : null;
    const moodPrompt =
      mood === 'aggressive' ? HORNYPAPS_AGGRESSIVE_SYSTEM_PROMPT : '';
    return [
      HORNYPAPS_SYSTEM_PROMPT,
      moodPrompt,
      `Метаданные стрима: текущая игра — ${gameLabel}.`,
      uptimeMetadata ? `Метаданные стрима: ${uptimeMetadata}.` : null,
      userMetadata,
    ]
      .filter(Boolean)
      .join('\n\n');
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
      lastWhereLocation = normalized;
      return normalized;
    }

    const fallback = pickFallbackLocation(lastWhereLocation ? [lastWhereLocation] : []);
    lastWhereLocation = fallback;
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
      lastWhenTime = normalized;
      return normalized;
    }

    const fallback = pickFallbackWhenTime(lastWhenTime ? [lastWhenTime] : []);
    lastWhenTime = fallback;
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
      lastWhereToDestination = normalized;
      return normalized;
    }

    const fallback = pickFallbackWhereToDestination(
      lastWhereToDestination ? [lastWhereToDestination] : []
    );
    lastWhereToDestination = fallback;
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
      lastWhatAction = normalized;
      return normalized;
    }

    const fallback = pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
    lastWhatAction = fallback;
    return fallback;
  }

  async function generateWhereLocation(subjectText) {
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
      console.error(
        'Failed to fetch Together.ai location:',
        formatTogetherError(err)
      );
    }

    return pickFallbackLocation(lastWhereLocation ? [lastWhereLocation] : []);
  }

  async function generateWhenTime(subjectText) {
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
      console.error(
        'Failed to fetch Together.ai time:',
        formatTogetherError(err)
      );
    }

    return pickFallbackWhenTime(lastWhenTime ? [lastWhenTime] : []);
  }

  async function generateWhereToDestination(subjectText) {
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
      console.error(
        'Failed to fetch Together.ai where-to destination:',
        formatTogetherError(err)
      );
      return pickFallbackWhereToDestination(
        lastWhereToDestination ? [lastWhereToDestination] : []
      );
    }

    return pickFallbackWhereToDestination(
      lastWhereToDestination ? [lastWhereToDestination] : []
    );
  }

  async function generateWhatAction(subjectText) {
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
      console.error(
        'Failed to fetch Together.ai activity:',
        formatTogetherError(err)
      );
      return pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
    }

    return pickFallbackWhatAction(lastWhatAction ? [lastWhatAction] : []);
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
      instructions.push(`Не повторяй дословно "${fallback}".`);
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
    instructions.push('Фраза должна состоять из одной короткой конструкции.');

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
      console.error(
        'Failed to fetch Together.ai intim variant:',
        formatTogetherError(err)
      );
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
        `Failed to fetch Together.ai poceluy variant (${variantLabel}):`,
        formatTogetherError(err)
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

  async function applyRandomPlaceholders(text, exclude = new Set()) {
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

  function getHornypapsUserRole(tags) {
    if (!tags) return 'viewer';
    const badges = tags.badges || {};
    if (badges.broadcaster) return 'streamer';
    if (tags.mod || badges.moderator) return 'moderator';
    if (badges.vip) return 'vip';
    if (tags.subscriber || badges.subscriber) return 'subscriber';
    if (tags['first-msg']) return 'newcomer';
    return 'viewer';
  }

  function normalizeHornypapsMoodWeights(weights) {
    if (!weights || typeof weights !== 'object') {
      return null;
    }
    const entries = Object.entries(weights)
      .filter(([, value]) => Number.isFinite(value) && value > 0);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return null;
    }
    return entries.reduce((acc, [key, value]) => {
      acc[key] = value / total;
      return acc;
    }, {});
  }

  function pickWeightedMood(weights) {
    const normalized = normalizeHornypapsMoodWeights(weights);
    if (!normalized) {
      return null;
    }
    const roll = Math.random();
    let cumulative = 0;
    for (const [mood, weight] of Object.entries(normalized)) {
      cumulative += weight;
      if (roll <= cumulative) {
        return mood;
      }
    }
    return null;
  }

  function adjustHornypapsMoodWeights(
    baseWeights,
    { tagCount, role, affinity = 0 }
  ) {
    const adjusted = { ...baseWeights };
    const pressure = Math.min(tagCount / 5, 2);

    if (tagCount >= 5) {
      adjusted.aggressive += 0.3 * pressure;
      adjusted.normal -= 0.15 * pressure;
      adjusted.sleepy -= 0.1 * pressure;
      adjusted.flirty -= 0.05 * pressure;
    } else if (tagCount >= 2) {
      adjusted.aggressive += 0.1 * pressure;
      adjusted.flirty += 0.05 * pressure;
      adjusted.normal -= 0.05 * pressure;
      adjusted.sleepy -= 0.05 * pressure;
    }

    switch (role) {
      case 'streamer':
        adjusted.normal += 0.2;
        adjusted.aggressive -= 0.1;
        break;
      case 'moderator':
        adjusted.normal += 0.1;
        adjusted.aggressive -= 0.05;
        break;
      case 'vip':
      case 'subscriber':
        adjusted.flirty += 0.1;
        break;
      case 'newcomer':
        adjusted.normal += 0.2;
        adjusted.aggressive -= 0.1;
        adjusted.sleepy -= 0.05;
        break;
      default:
        break;
    }

    if (Number.isFinite(affinity) && affinity !== 0) {
      const magnitude = Math.min(Math.abs(affinity) / 50, 1);
      if (affinity > 0) {
        adjusted.normal += 0.2 * magnitude;
        adjusted.flirty += 0.15 * magnitude;
        adjusted.aggressive -= 0.2 * magnitude;
        adjusted.sleepy -= 0.05 * magnitude;
      } else {
        adjusted.aggressive += 0.25 * magnitude;
        adjusted.normal -= 0.15 * magnitude;
        adjusted.flirty -= 0.1 * magnitude;
      }
    }

    Object.keys(adjusted).forEach((key) => {
      adjusted[key] = Math.max(0, adjusted[key]);
    });

    return adjusted;
  }

  async function generateHornypapsReply({
    username = '',
    role = 'user',
    message = '',
    history = [],
    mood = 'normal',
    userAffinity = null,
    lastAffinityNote = null,
    userMetadata = '',
  } = {}) {
    const trimmedMessage = String(message || '').trim();
    const cleanMessage =
      trimmedMessage
        .replace(/@hornypaps\b/gi, '')
        .replace(/^[\s,.:;!?-]+/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'нужен ответ на тэг';
    const normalizedHistory = Array.isArray(history) ? history : [];
    const limitedHistory = normalizedHistory.slice(-HORNYPAPS_HISTORY_LIMIT);
    const formattedHistory = limitedHistory
      .filter((entry) => entry && entry.message)
      .map((entry) => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: `${entry.username || 'user'}: ${entry.message}`,
      }));

    const lastEntry = limitedHistory[limitedHistory.length - 1];
    const shouldAppendPrompt = !(
      lastEntry &&
      lastEntry.message === message &&
      normalizeUsername(lastEntry.username) === normalizeUsername(username)
    );

    const affinityValue =
      typeof userAffinity === 'number' && Number.isFinite(userAffinity)
        ? userAffinity
        : null;
    const affinityNote =
      typeof lastAffinityNote === 'string' && lastAffinityNote.trim()
        ? lastAffinityNote.trim()
        : null;
    const affinityStatus =
      affinityValue === null
        ? ''
        : affinityValue >= 50
        ? 'Этот пользователь твой любимчик.'
        : affinityValue >= 20
        ? 'К этому пользователю ты относишься очень тепло.'
        : affinityValue >= 5
        ? 'К этому пользователю ты относишься дружелюбно.'
        : affinityValue <= -50
        ? 'Этот пользователь недавно тебя сильно разозлил.'
        : affinityValue <= -20
        ? 'Этот пользователь тебя раздражает.'
        : affinityValue <= -5
        ? 'Ты раздражена на этого пользователя.'
        : '';
    const affinityContext =
      affinityValue !== null || affinityNote || affinityStatus
        ? [
            `Метаданные пользователя ${username || 'user'}:`,
            affinityStatus,
            affinityValue !== null
              ? `affinity=${affinityValue}.`
              : 'affinity=неизвестно.',
            affinityNote ? `Последняя заметка: ${affinityNote}.` : '',
          ]
            .filter(Boolean)
            .join(' ')
        : '';
    const combinedMetadata = [affinityContext, userMetadata]
      .filter(Boolean)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: getHornypapsSystemPrompt({
          mood,
          userMetadata: combinedMetadata,
        }),
      },
      ...formattedHistory,
    ];

    if (shouldAppendPrompt) {
      messages.push({
        role: role === 'assistant' ? 'assistant' : 'user',
        content: `${username || 'user'}: ${cleanMessage}`,
      });
    }

    try {
      const result = await requestTogetherChat({
        messages,
        ...HORNYPAPS_REPLY_SETTINGS,
        normalize: normalizeHornypapsReply,
      });

      if (result?.text) {
        return result.text;
      }
    } catch (err) {
      console.error(
        'Failed to fetch Together.ai Hornypaps reply:',
        formatTogetherError(err)
      );
    }

    return null;
  }

  return {
    addChatHistory,
    getChatHistorySnapshot,
    generateWhereLocation,
    pickFallbackLocation,
    ensureDistinctWhereLocation,
    generateWhenTime,
    pickFallbackWhenTime,
    ensureDistinctWhenTime,
    generateWhatAction,
    pickFallbackWhatAction,
    ensureDistinctWhatAction,
    generateWhereToDestination,
    pickFallbackWhereToDestination,
    ensureDistinctWhereToDestination,
    generateIntimVariantOne,
    generatePoceluyVariantTwo,
    generatePoceluyVariantThree,
    generatePoceluyVariantFour,
    applyRandomPlaceholders,
    generateHornypapsReply,
    getHornypapsUserRole,
    adjustHornypapsMoodWeights,
    pickWeightedMood,
    normalizeUsername,
    formatUserFactsMetadata,
    escapeRegExp,
  };
}

module.exports = {
  createAiService,
  WHERE_FALLBACK_LOCATIONS,
  WHEN_FALLBACK_TIMES,
  WHAT_FALLBACK_ACTIONS,
  WHERETO_FALLBACK_DESTINATIONS,
};
