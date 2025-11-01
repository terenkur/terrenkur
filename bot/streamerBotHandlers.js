'use strict';

const fs = require('fs');
const path = require('path');

const resolveSharedModule = (relativePath) => {
  const attempted = new Set();

  const tryCandidate = (candidate) => {
    if (attempted.has(candidate)) {
      return null;
    }
    attempted.add(candidate);
    return fs.existsSync(candidate) ? candidate : null;
  };

  const { root } = path.parse(__dirname);
  let currentDir = __dirname;

  while (currentDir && currentDir !== path.dirname(currentDir)) {
    const fromCurrentDir = tryCandidate(
      path.join(currentDir, 'shared', relativePath)
    );

    if (fromCurrentDir) {
      return require(fromCurrentDir);
    }

    if (currentDir === root) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  const fromCwd = tryCandidate(path.join(process.cwd(), 'shared', relativePath));
  if (fromCwd) {
    return require(fromCwd);
  }

  const searchedLocations = Array.from(attempted).join('\n - ');
  throw new Error(
    `Unable to locate shared module "${relativePath}". Checked the following locations:\n - ${searchedLocations}`
  );
};

const { intim: INTIM_TYPES, poceluy: POCELUY_TYPES } = resolveSharedModule('intimPoceluyTypes.json');
const streamerBotActions = resolveSharedModule('streamerBotActions.js');

/**
 * Creates a handlers map that covers all known Streamer.bot action types while
 * keeping the ability to override individual handlers by editing this file or
 * by supplying action GUIDs/names through environment variables (see
 * {@link streamerBotActions}).
 *
 * The special `__default__` key is used when no direct match is found. All
 * other keys are pre-populated from {@link INTIM_TYPES} and
 * {@link POCELUY_TYPES} to guarantee that every supported type is covered even
 * before custom handlers are added.
 *
 * @param {readonly string[]} types
 */
const createActionHandler = (actionIdOrName) => {
  const trimmed = typeof actionIdOrName === 'string' ? actionIdOrName.trim() : '';
  if (!trimmed) {
    return null;
  }
  return async (context) => {
    await context.trigger(trimmed);
  };
};

const createHandlersMap = (types, configuredActions = {}) => {
  const defaultHandler =
    createActionHandler(configuredActions.__default__) ||
    (async (context) => {
      await context.triggerDefault();
    });

  return types.reduce(
    (acc, type) => {
      const handler =
        createActionHandler(configuredActions[type]) || acc[type] || defaultHandler;
      acc[type] = handler;
      return acc;
    },
    { __default__: defaultHandler }
  );
};

/**
 * Handlers for Streamer.bot typed actions.
 *
 * Keys in the `intim` and `poceluy` objects correspond to the `type` argument
 * received from the bot (for example: "intim_no_tag_0"). To customise the
 * behaviour for a specific type, either set the respective SB_* environment
 * variable (see {@link ../shared/streamerBotActions.js}) or replace the handler
 * in the corresponding object, for example:
 *
 *   streamerBotHandlers.intim.intim_no_tag_0 = async (context) => {
 *     await context.trigger("Custom Intim Action");
 *   };
 */
const streamerBotHandlers = {
  intim: createHandlersMap(INTIM_TYPES, streamerBotActions.intim),
  poceluy: createHandlersMap(POCELUY_TYPES, streamerBotActions.poceluy),
};

module.exports = streamerBotHandlers;
