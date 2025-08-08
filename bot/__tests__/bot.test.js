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

const loadBotWithOn = (mockSupabase, onMock, sayMock = jest.fn()) => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => ({ connect: jest.fn(), on: onMock, say: sayMock })),
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
    from: jest.fn((table) => {
      if (table === 'votes') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: existingVotes, error: null }))
            }))
          })),
          insert: insertMock,
        };
      }
      if (table === 'donationalerts_tokens') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
              }))
            }))
          })),
        };
      }
      return {
        select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        insert: jest.fn(),
      };
    }),
  };
};

const createSupabaseUsers = (existingUser, insertedUser) => {
  const maybeSingle = jest.fn(() => Promise.resolve({ data: existingUser, error: null }));
  const eq = jest.fn(() => ({ maybeSingle }));
  const selectUsers = jest.fn(() => ({ eq }));
  const insertSingle = jest.fn(() => Promise.resolve({ data: insertedUser, error: null }));
  const insertSelect = jest.fn(() => ({ single: insertSingle }));
  const insertUsers = jest.fn(() => ({ select: insertSelect }));
  return {
    from: jest.fn((table) => {
      if (table === 'users') {
        return { select: selectUsers, insert: insertUsers };
      }
      if (table === 'donationalerts_tokens') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
              }))
            }))
          }))
        };
      }
      return {
        select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        insert: jest.fn(),
      };
    }),
    eq,
    insertUsers,
  };
};

const createSupabaseMessage = (
  existingVotes,
  insertMock = jest.fn(() => Promise.resolve({ error: null })),
  { existingUser = { id: 1, username: 'User', vote_limit: 1 }, insertedUser } = {}
) => {
  return {
    from: jest.fn((table) => {
      if (table === 'polls') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() => Promise.resolve({ data: { id: 5 }, error: null }))
                }))
              }))
            }))
          }))
        };
      }
      if (table === 'settings') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: { value: 1 }, error: null }))
            }))
          }))
        };
      }
      if (table === 'poll_games') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [{ games: { id: 10, name: 'Doom' } }], error: null }))
          }))
        };
      }
      if (table === 'votes') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: existingVotes, error: null }))
            }))
          })),
          insert: insertMock,
        };
      }
      if (table === 'users') {
        const selectUsers = jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: existingUser, error: null }))
          }))
        }));
        let insertUsers = jest.fn();
        if (!existingUser) {
          const single = jest.fn(() => Promise.resolve({ data: insertedUser, error: null }));
          insertUsers = jest.fn(() => ({ select: jest.fn(() => ({ single })) }));
        }
        return { select: selectUsers, insert: insertUsers };
      }
      if (table === 'log_rewards') {
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
      }
      if (table === 'event_logs') {
        return { insert: jest.fn() };
      }
      if (table === 'donationalerts_tokens') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
              }))
            }))
          }))
        };
      }
      return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
    })
  };
};

describe('parseCommand', () => {
  const { parseCommand } = loadBot(createSupabase([]));

  test('parses !game prefix', () => {
    expect(parseCommand('!game Doom')).toEqual({
      prefix: '!game',
      args: ['Doom'],
    });
  });

  test('parses !игра prefix with spaces', () => {
    expect(parseCommand('  !игра  Ведьмак  ')).toEqual({
      prefix: '!игра',
      args: ['Ведьмак'],
    });
  });

  test('parses uppercase !GAME prefix', () => {
    expect(parseCommand('!GAME Doom')).toEqual({
      prefix: '!game',
      args: ['Doom'],
    });
  });

  test('parses mixed-case !ИгрА prefix', () => {
    expect(parseCommand('  !ИгрА  Ведьмак  ')).toEqual({
      prefix: '!игра',
      args: ['Ведьмак'],
    });
  });

  test('splits remaining message into args', () => {
    expect(parseCommand('!game Doom Eternal')).toEqual({
      prefix: '!game',
      args: ['Doom', 'Eternal'],
    });
  });

  test('returns null for unknown command', () => {
    expect(parseCommand('hello')).toBeNull();
  });
});

describe('findOrCreateUser', () => {
  test('retrieves existing user by twitch_login', async () => {
    const existing = { id: 1, username: 'Display', twitch_login: 'login' };
    const mock = createSupabaseUsers(existing);
    const { findOrCreateUser } = loadBot(mock);
    const user = await findOrCreateUser({ username: 'Login', 'display-name': 'Display' });
    expect(mock.eq).toHaveBeenCalledWith('twitch_login', 'login');
    expect(mock.insertUsers).not.toHaveBeenCalled();
    expect(user).toEqual(existing);
  });

  test('creates new user with username and lowercase twitch_login', async () => {
    const inserted = { id: 2, username: 'Display', twitch_login: 'login' };
    const mock = createSupabaseUsers(null, inserted);
    const { findOrCreateUser } = loadBot(mock);
    const user = await findOrCreateUser({ username: 'LoGin', 'display-name': 'Display' });
    expect(mock.eq).toHaveBeenCalledWith('twitch_login', 'login');
    expect(mock.insertUsers).toHaveBeenCalledWith({ username: 'Display', twitch_login: 'login' });
    expect(user).toEqual(inserted);
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

  test('returns db error on insert failure', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: new Error('fail') }));
    const supabase = createSupabase([], insert);
    const { addVote } = loadBot(supabase);
    const res = await addVote({ id: 1, vote_limit: 1 }, 5, 10);
    expect(res).toEqual({ success: false, reason: 'db error' });
  });
});

describe('message handler vote results', () => {
  test('notifies when vote limit reached', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage([{ slot: 1 }]);
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game Doom', false);
    expect(say).toHaveBeenCalledWith('channel', '@user, лимит голосов исчерпан.');
  });

  test('shows technical message for unknown reason', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const insert = jest.fn(() => Promise.resolve({ error: new Error('fail') }));
    const supabase = createSupabaseMessage([], insert);
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game Doom', false);
    expect(say).toHaveBeenCalledWith(
      'channel',
      '@user, не удалось обработать голос из-за технических проблем.'
    );
  });
});

describe('message handler subcommands', () => {
  test('lists games for active poll', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage([]);
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game список', false);
    expect(say).toHaveBeenCalledWith('channel', 'Doom');
  });

  test('reports remaining votes', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage([{ id: 1 }]);
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(say).toHaveBeenCalledWith('channel', '@user, у вас осталось 0 голосов.');
  });

  test('reports remaining votes for new user with default limit', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage([], undefined, {
      existingUser: null,
      insertedUser: { id: 2, username: 'user' },
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(say).toHaveBeenCalledWith('channel', '@user, у вас осталось 1 голосов.');
  });

  test('reports remaining votes with custom vote limit', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage(
      [{ id: 1 }, { id: 2 }],
      undefined,
      { existingUser: { id: 1, username: 'User', vote_limit: 5 } }
    );
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(say).toHaveBeenCalledWith('channel', '@user, у вас осталось 3 голосов.');
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
        if (table === 'donationalerts_tokens') {
          return {
            select: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
                }))
              }))
            })),
          };
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

    expect(insertMock).toHaveBeenCalledWith({
      message: `Reward ${rewardId} redeemed by User: Hello`,
      media_url: null,
      preview_url: null,
    });
  });

  test('logs media url and preview for music reward with valid youtube link', async () => {
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
        }
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        if (table === 'donationalerts_tokens') {
          return {
            select: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
                }))
              }))
            })),
          };
        }
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
      }),
    };
    const on = jest.fn();
    loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    const link = 'https://youtu.be/abc123';
    await messageHandler(
      'channel',
      { 'custom-reward-id': '545cc880-f6c1-4302-8731-29075a8a1f17', 'display-name': 'User' },
      link,
      false
    );
    expect(insertMock).toHaveBeenCalledWith({
      message: `Reward 545cc880-f6c1-4302-8731-29075a8a1f17 redeemed by User: ${link}`,
      media_url: link,
      preview_url: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
    });
  });

  test('warns and skips music reward with invalid link', async () => {
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
        }
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        if (table === 'donationalerts_tokens') {
          return {
            select: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
                }))
              }))
            })),
          };
        }
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
      }),
    };
    const on = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    const link = 'https://example.com/video';
    await messageHandler(
      'channel',
      { 'custom-reward-id': '545cc880-f6c1-4302-8731-29075a8a1f17', 'display-name': 'User' },
      link,
      false
    );
    expect(insertMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(`Music reward invalid link: ${link}`);
    consoleSpy.mockRestore();
  });
});

describe('donation logging', () => {
  test('logs donations with and without media', async () => {
    const insertMock = jest.fn((payload) => {
      expect(payload).toHaveProperty('media_url');
      expect(payload).toHaveProperty('preview_url');
      return Promise.resolve({ error: null });
    });
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
        }
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        if (table === 'donationalerts_tokens') {
          return {
            select: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() =>
                    Promise.resolve({
                      data: {
                        access_token: 'da',
                        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                      },
                      error: null,
                    })
                  ),
                }))
              }))
            })),
          };
        }
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
      }),
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, username: 'Alice', amount: '10', currency: 'USD' },
          { id: 2, username: 'Bob', amount: '5', currency: 'USD', media: { url: 'http://clip' } },
          {
            id: 3,
            username: 'Carol',
            amount: '7',
            currency: 'USD',
            media: { url: 'https://youtu.be/abc123' },
          },
        ],
      }),
    });

    loadBot(supabase);
    await new Promise(setImmediate);

    expect(insertMock).toHaveBeenNthCalledWith(1, {
      message: 'Donation from Alice: 10 USD',
      media_url: null,
      preview_url: null,
    });
    expect(insertMock).toHaveBeenNthCalledWith(2, {
      message: 'Donation from Bob: 5 USD',
      media_url: 'http://clip',
      preview_url: null,
    });
    expect(insertMock).toHaveBeenNthCalledWith(3, {
      message: 'Donation from Carol: 7 USD',
      media_url: 'https://youtu.be/abc123',
      preview_url: expect.stringContaining('img.youtube.com'),
    });

    global.fetch.mockRestore();
  });
});
