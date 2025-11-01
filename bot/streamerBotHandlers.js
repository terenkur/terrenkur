'use strict';

const {
  intim: INTIM_TYPES,
  poceluy: POCELUY_TYPES,
} = require('../shared/intimPoceluyTypes.json');

/**
 * Creates a handlers map that covers all known Streamer.bot action types while
 * keeping the ability to override individual handlers by editing this file.
 *
 * The special `__default__` key is used when no direct match is found. All
 * other keys are pre-populated from {@link INTIM_TYPES} and
 * {@link POCELUY_TYPES} to guarantee that every supported type is covered even
 * before custom handlers are added.
 *
 * @param {readonly string[]} types
 */
const createHandlersMap = (types) => {
  const defaultHandler = async (context) => {
    await context.triggerDefault();
  };

  return types.reduce(
    (acc, type) => {
      acc[type] = acc[type] || defaultHandler;
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
 * behaviour for a specific type, replace the handler in the corresponding
 * object, for example:
 *
 *   streamerBotHandlers.intim.intim_no_tag_0 = async (context) => {
 *     await context.trigger("Custom Intim Action");
 *   };
 */
const streamerBotHandlers = {
  intim: createHandlersMap(INTIM_TYPES),
  poceluy: createHandlersMap(POCELUY_TYPES),
};

module.exports = streamerBotHandlers;
