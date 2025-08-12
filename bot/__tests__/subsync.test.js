const loadBot = (supabase, fetchImpl) => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => supabase),
  }));
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => ({
      connect: jest.fn(),
      on: jest.fn(),
      opts: { identity: {} },
    })),
  }));
  global.fetch = fetchImpl;
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.BOT_TOKEN = 'token';
  process.env.TWITCH_CHANNEL = 'channel';
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_CHANNEL_ID = 'chan1';
  process.env.TWITCH_SECRET = 'secret';
  process.env.MUSIC_REWARD_ID = 'id';
  const bot = require('../bot');
  jest.useRealTimers();
  return bot;
};

function createSupabase(existingUser) {
  const maybeSingleUser = jest.fn(() =>
    Promise.resolve({ data: existingUser, error: null })
  );
  const eqUser = jest.fn(() => ({ maybeSingle: maybeSingleUser }));
  const selectUser = jest.fn(() => ({ eq: eqUser }));
  const updateEq = jest.fn(() => Promise.resolve({ error: null }));
  const updateUser = jest.fn(() => ({ eq: updateEq }));
  const from = jest.fn((table) => {
    if (table === 'users') {
      return { select: selectUser, insert: jest.fn(), update: updateUser };
    }
    if (table === 'twitch_tokens') {
      return {
        select: jest.fn(() => ({
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                access_token: 'stream',
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              },
              error: null,
            })
          ),
        })),
      };
    }
    if (table === 'donationalerts_tokens') {
      return {
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      };
    }
    if (table === 'log_rewards') {
      return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
    }
    return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
  });
  return { supabase: { from }, updateEq };
}

describe('updateSubMonths', () => {
  test('updates months for regular user', async () => {
    const existingUser = {
      id: 1,
      username: 'user',
      twitch_login: 'user',
      total_months_subbed: 2,
    };
    const { supabase, updateEq } = createSupabase(existingUser);
    const fetchImpl = jest.fn(async (url) => {
      const u = String(url);
      if (u.includes('id.twitch.tv')) {
        return { ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) };
      }
      if (u.includes('users?login=channel')) {
        return { ok: true, json: async () => ({ data: [{ id: 'chan1' }] }) };
      }
      if (u.includes('subscriptions') && u.includes('user_id=chan1')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      if (u.includes('subscriptions') && u.includes('user_id=123')) {
        return {
          ok: true,
          json: async () => ({ data: [{ cumulative_months: 5 }] }),
        };
      }
      if (u.includes('users?login=user')) {
        return { ok: true, json: async () => ({ data: [{ id: '123' }] }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    });

    const { updateSubMonths } = loadBot(supabase, fetchImpl);
    await updateSubMonths('user');
    expect(updateEq).toHaveBeenCalledWith('id', 1);
  });

  test('does not update for channel owner without sub', async () => {
    const existingUser = {
      id: 1,
      username: 'channel',
      twitch_login: 'channel',
      total_months_subbed: 0,
    };
    const { supabase, updateEq } = createSupabase(existingUser);
    const fetchImpl = jest.fn(async (url) => {
      const u = String(url);
      if (u.includes('id.twitch.tv')) {
        return { ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) };
      }
      if (u.includes('users?login=channel')) {
        return { ok: true, json: async () => ({ data: [{ id: 'chan1' }] }) };
      }
      if (u.includes('subscriptions') && u.includes('user_id=chan1')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    });

    const { updateSubMonths } = loadBot(supabase, fetchImpl);
    await updateSubMonths('channel');
    expect(updateEq).not.toHaveBeenCalled();
  });
});

