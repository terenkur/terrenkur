const DEFAULT_MESSAGE_HANDLER_CONFIG = {
  hornypapsThrottleMs: 12 * 1000,
  hornypapsGlobalThrottleMs: 4 * 1000,
  hornypapsMoodWindowMs: 60 * 1000,
  hornypapsTagsPerUserCap: 2,
  hornypapsReplyMaxLength: 460,
  userDataCacheTtlMs: 2 * 60 * 1000,
  userDataCacheCleanupIntervalMs: 60 * 1000,
  userDataCacheMaxEntries: 5000,
};

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseString(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseJsonConfig(rawJson) {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to parse MESSAGE_HANDLER_CONFIG_JSON', err);
    return {};
  }
}

function loadMessageHandlerConfig({
  env = process.env,
  jsonConfig,
  supabaseConfig = {},
} = {}) {
  const jsonOverrides =
    jsonConfig || parseJsonConfig(env.MESSAGE_HANDLER_CONFIG_JSON);

  const envOverrides = {
    hornypapsThrottleMs: parseNumber(
      env.HORNY_PAPS_THROTTLE_MS,
      undefined
    ),
    hornypapsGlobalThrottleMs: parseNumber(
      env.HORNY_PAPS_GLOBAL_THROTTLE_MS,
      undefined
    ),
    hornypapsMoodWindowMs: parseNumber(
      env.HORNY_PAPS_MOOD_WINDOW_MS,
      undefined
    ),
    hornypapsTagsPerUserCap: parseNumber(
      env.HORNY_PAPS_TAGS_PER_USER_CAP,
      undefined
    ),
    hornypapsReplyMaxLength: parseNumber(
      env.HORNYPAPS_REPLY_MAX_LENGTH,
      undefined
    ),
    userDataCacheTtlMs: parseNumber(env.USER_DATA_CACHE_TTL_MS, undefined),
    userDataCacheCleanupIntervalMs: parseNumber(
      env.USER_DATA_CACHE_CLEANUP_INTERVAL_MS,
      undefined
    ),
    userDataCacheMaxEntries: parseNumber(
      env.USER_DATA_CACHE_MAX_ENTRIES,
      undefined
    ),
    extraVoteRewardId: parseString(env.EXTRA_VOTE_REWARD_ID),
  };

  return {
    ...DEFAULT_MESSAGE_HANDLER_CONFIG,
    ...supabaseConfig,
    ...jsonOverrides,
    ...Object.fromEntries(
      Object.entries(envOverrides).filter(([, value]) => value !== undefined)
    ),
  };
}

module.exports = {
  DEFAULT_MESSAGE_HANDLER_CONFIG,
  loadMessageHandlerConfig,
};
