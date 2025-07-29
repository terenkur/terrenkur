const loadBot = (mockSupabase) => {
  jest.resetModules();
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
  return require('../bot');
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
