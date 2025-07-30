const loadBot = (mockSupabase) => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => ({ connect: jest.fn(), on: jest.fn() })),
  }));
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.BOT_OAUTH_TOKEN = 'token';
  process.env.TWITCH_CHANNEL = 'channel';
  const bot = require('../bot');
  jest.useRealTimers();
  return bot;
};

const loadBotWithOn = (mockSupabase, onMock) => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => ({ connect: jest.fn(), on: onMock })),
  }));
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.BOT_OAUTH_TOKEN = 'token';
  process.env.TWITCH_CHANNEL = 'channel';
  delete process.env.LOG_REWARD_IDS;
  const bot = require('../bot');
  jest.useRealTimers();
  return bot;
};

const createSupabase = (
  existingVotes,
  insertMock = jest.fn(() => Promise.resolve({ error: null }))
) => {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: existingVotes, error: null }))
        }))
      })),
      insert: insertMock,
    })),
  };
};

describe('parseCommand', () => {
  const { parseCommand } = loadBot(createSupabase([]));

  test('parses !game prefix', () => {
    expect(parseCommand('!game Doom')).toEqual({
      prefix: '!game',
      gameName: 'Doom',
    });
  });

  test('parses !игра prefix with spaces', () => {
    expect(parseCommand('  !игра  Ведьмак  ')).toEqual({
      prefix: '!игра',
      gameName: 'Ведьмак',
    });
  });

  test('returns null for unknown command', () => {
    expect(parseCommand('hello')).toBeNull();
  });
});

describe('addVote', () => {
  test('inserts vote in first slot', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = createSupabase([], insert);
    const { addVote } = loadBot(supabase);
    const res = await addVote({ id: 1, vote_limit: 2 }, 5, 10);
    expect(res).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith({
      poll_id: 5,
      game_id: 10,
      user_id: 1,
      slot: 1,
    });
  });

  test('respects vote limit', async () => {
    const insert = jest.fn();
    const supabase = createSupabase([{ slot: 1 }], insert);
    const { addVote } = loadBot(supabase);
    const res = await addVote({ id: 1, vote_limit: 1 }, 5, 10);
    expect(res).toEqual({ success: false, reason: 'vote limit reached' });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('reward logging', () => {
  test('logs message when reward ID fetched from DB', async () => {
    const rewardId = 'abc';
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return { select: jest.fn(() => Promise.resolve({ data: [{ reward_id: rewardId }], error: null })) };
        }
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
      }),
    };
    const on = jest.fn();
    loadBotWithOn(supabase, on);

    // wait for async reward fetch
    await new Promise(setImmediate);

    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { 'custom-reward-id': rewardId, 'display-name': 'User' }, 'Hello', false);

    expect(insertMock).toHaveBeenCalledWith({ message: `Reward ${rewardId} redeemed by User: Hello` });
  });
});
