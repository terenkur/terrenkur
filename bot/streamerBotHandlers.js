'use strict';

/**
 * Handlers for Streamer.bot typed actions.
 *
 * Keys in the `intim` and `poceluy` objects correspond to the `type` argument
 * received from the bot (for example: "intim_no_tag_0"). The special
 * `__default__` key is used when no direct match is found.
 *
 * Each handler receives a {@link StreamerBotActionContext}. Use
 * `context.trigger(actionName, payload?)` to run a custom Streamer.bot action or
 * `context.triggerDefault(payload?)` to fall back to the default action defined
 * in the environment variables.
 */
const streamerBotHandlers = {
  intim: {
    /**
     * Default intim handler. Replace or extend this map with custom handlers,
     * for example:
     *   'intim_no_tag_0': async (context) => {
     *     await context.trigger('Custom Intim Action');
     *   },
     */
    __default__: async (context) => {
      await context.triggerDefault();
    },
  },
  poceluy: {
    /**
     * Default poceluy handler. Add extra handlers keyed by the `type` value
     * returned from the Twitch command to run custom Streamer.bot actions.
     */
    __default__: async (context) => {
      await context.triggerDefault();
    },
  },
};

module.exports = streamerBotHandlers;
