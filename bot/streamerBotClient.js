'use strict';

const STREAMERBOT_GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeValue(value) {
  if (value == null) return '';
  return String(value).replace(/[\n\r]/g, ' ').trim();
}

function buildArgs(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const orderedKeys = ['type', 'initiator', 'target'];
  const args = {};
  for (const key of orderedKeys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      args[key] = sanitizeValue(payload[key]);
    }
  }
  return args;
}

class StreamerBotActionContext {
  constructor({ client, defaultAction, payload }) {
    this._client = client;
    this._defaultAction = defaultAction;
    this.payload = payload || {};
  }

  get type() {
    const raw = this.payload?.type;
    return typeof raw === 'string' ? raw.trim() : '';
  }

  get initiator() {
    return this.payload?.initiator ?? null;
  }

  get target() {
    return this.payload?.target ?? null;
  }

  hasDefaultAction() {
    return Boolean(this._defaultAction);
  }

  async trigger(actionIdOrName, overridePayload = null) {
    if (!actionIdOrName) return;
    const mergedPayload = {
      ...this.payload,
      ...(overridePayload && typeof overridePayload === 'object'
        ? overridePayload
        : {}),
    };
    await this._client.triggerAction(actionIdOrName, mergedPayload);
  }

  async triggerDefault(overridePayload = null) {
    if (!this.hasDefaultAction()) return;
    await this.trigger(this._defaultAction, overridePayload);
  }
}

class StreamerBotClient {
  constructor({ baseUrl, fetchImpl }) {
    const defaultBase = 'http://localhost:7478';
    const trimmed = (baseUrl && baseUrl.trim()) || defaultBase;
    this.baseUrl = trimmed.replace(/\/$/, '');
    this.fetch = fetchImpl || fetch;
  }

  async triggerAction(actionIdOrName, payload) {
    if (!actionIdOrName) return;
    const trimmedAction = actionIdOrName.trim();
    if (!trimmedAction) return;

    const args = buildArgs(payload);
    const body = { action: {} };
    if (STREAMERBOT_GUID_REGEX.test(trimmedAction)) {
      body.action.id = trimmedAction;
    } else {
      body.action.name = trimmedAction;
    }
    if (Object.keys(args).length > 0) {
      body.args = args;
    }

    try {
      const resp = await this.fetch(`${this.baseUrl}/DoAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error(
          `Failed to trigger Streamer.bot action ${trimmedAction}: ${resp.status} ${text}`
        );
      }
    } catch (err) {
      console.error('Failed to trigger Streamer.bot action:', err);
    }
  }
}

function createTypedDispatcher({
  client,
  defaultAction,
  typeHandlers = {},
  logger = console,
}) {
  const entries = Object.entries(typeHandlers || {});
  const handlerMap = new Map(entries);
  const defaultHandler = handlerMap.get('__default__');

  return async function dispatch(payload = {}) {
    const context = new StreamerBotActionContext({
      client,
      defaultAction,
      payload,
    });
    const type = context.type;
    const handler = (type && handlerMap.get(type)) || defaultHandler;

    if (!handler) {
      await context.triggerDefault();
      return;
    }

    try {
      await handler(context);
    } catch (err) {
      logger.error?.(
        `Streamer.bot handler failed for ${type || 'default'}:`,
        err
      );
      if (context.hasDefaultAction()) {
        await context.triggerDefault();
      }
    }
  };
}

function createStreamerBotIntegration({
  baseUrl,
  actions = {},
  handlers = {},
  fetchImpl,
  logger = console,
}) {
  const client = new StreamerBotClient({ baseUrl, fetchImpl });

  const triggerIntim = createTypedDispatcher({
    client,
    defaultAction: actions.intim,
    typeHandlers: handlers.intim,
    logger,
  });

  const triggerPoceluy = createTypedDispatcher({
    client,
    defaultAction: actions.poceluy,
    typeHandlers: handlers.poceluy,
    logger,
  });

  return {
    client,
    triggerAction: client.triggerAction.bind(client),
    triggerIntim,
    triggerPoceluy,
  };
}

module.exports = {
  createStreamerBotIntegration,
  StreamerBotClient,
  StreamerBotActionContext,
};
