(function () {
  function coerceToObject(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (err) {
        const parts = value.split('|');
        if (parts.length === 3) {
          return { type: parts[0], initiator: parts[1], target: parts[2] };
        }
        return null;
      }
    }
    if (typeof value === 'object') {
      if (Array.isArray(value) && value.length === 3) {
        return { type: value[0], initiator: value[1], target: value[2] };
      }
      return value;
    }
    return null;
  }

  function getArgumentsFromContext(ctx) {
    if (!ctx) return null;
    const candidates = [
      () => ctx.Arguments,
      () => ctx.arguments,
      () => ctx.MixItUpArguments,
      () => ctx.MIUScriptArguments,
      () => ctx.MixItUp?.Arguments,
      () => ctx.ScriptArguments,
    ];
    for (const getter of candidates) {
      try {
        const value = getter && getter();
        const parsed = coerceToObject(value);
        if (parsed) return parsed;
      } catch (err) {
        continue;
      }
    }
    return null;
  }

  function resolveArguments() {
    if (typeof window === 'undefined') return null;
    const visited = new Set();
    const contexts = [];

    function push(ctx) {
      if (!ctx || visited.has(ctx)) return;
      visited.add(ctx);
      contexts.push(ctx);
    }

    push(window);
    try {
      if (window.parent && window.parent !== window) push(window.parent);
    } catch (err) {}
    try {
      if (window.top && window.top !== window && window.top !== window.parent) {
        push(window.top);
      }
    } catch (err) {}

    for (const ctx of contexts) {
      const args = getArgumentsFromContext(ctx);
      if (args) return args;
    }
    return null;
  }

  function run() {
    const args = resolveArguments();
    if (!args) {
      return { error: 'Arguments пустые или недоступны' };
    }

    const { type = 'unknown', initiator = 'n/a', target = 'n/a' } = args;
    const message = `${initiator} вызывает интим с ${target} (${type})`;

    return { type, initiator, target, message };
  }

  const result = run();
  if (typeof sendParentMessage === 'function') {
    sendParentMessage({ Type: 'ScriptComplete', ID: '{ID}', Result: result });
  }
})();
