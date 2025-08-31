const loadBot = (mockSupabase) => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => ({
      connect: jest.fn(),
      on: jest.fn(),
      opts: { identity: {} },
    })),
  }));
  const originalFrom = mockSupabase.from;
  mockSupabase.from = jest.fn((table) => {
    if (table === 'bot_tokens') {
      return {
        select: jest.fn(() => ({
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                id: 1,
                access_token: 'token',
                refresh_token: 'refresh',
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              },
              error: null,
            })
          ),
        })),
        update: jest.fn(() => Promise.resolve({ error: null })),
        insert: jest.fn(() => Promise.resolve({ error: null })),
      };
    }
    if (table === 'twitch_tokens') {
      return {
        select: jest.fn(() => ({
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                access_token: 'streamer',
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              },
              error: null,
            })
          ),
        })),
      };
    }
    return originalFrom(table);
  });
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.TWITCH_CHANNEL = 'channel';
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_CHANNEL_ID = '123';
  process.env.MUSIC_REWARD_ID = '545cc880-f6c1-4302-8731-29075a8a1f17';
  delete process.env.TWITCH_OAUTH_TOKEN;
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
    Client: jest.fn(() => ({
      connect: jest.fn(),
      on: onMock,
      say: sayMock,
      opts: { identity: {} },
    })),
  }));
  const originalFrom = mockSupabase.from;
  mockSupabase.from = jest.fn((table) => {
    if (table === 'bot_tokens') {
      return {
        select: jest.fn(() => ({
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                id: 1,
                access_token: 'token',
                refresh_token: 'refresh',
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              },
              error: null,
            })
          ),
        })),
        update: jest.fn(() => Promise.resolve({ error: null })),
        insert: jest.fn(() => Promise.resolve({ error: null })),
      };
    }
    if (table === 'twitch_tokens') {
      return {
        select: jest.fn(() => ({
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                access_token: 'streamer',
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              },
              error: null,
            })
          ),
        })),
      };
    }
    return originalFrom(table);
  });
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.TWITCH_CHANNEL = 'channel';
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_CHANNEL_ID = '123';
  process.env.MUSIC_REWARD_ID = '545cc880-f6c1-4302-8731-29075a8a1f17';
  delete process.env.LOG_REWARD_IDS;
  delete process.env.TWITCH_OAUTH_TOKEN;
  const bot = require('../bot');
  jest.useRealTimers();
  return bot;
};

const loadBotNoToken = (connectMock = jest.fn()) => {
  jest.resetModules();
  jest.useFakeTimers();
  const mockSupabase = {
    from: jest.fn((table) => {
      if (table === 'bot_tokens') {
        return {
          select: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
          })),
        };
      }
      return {
        select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        insert: jest.fn(() => Promise.resolve({ error: null })),
        update: jest.fn(() => Promise.resolve({ error: null })),
      };
    }),
  };
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => ({
      connect: connectMock,
      on: jest.fn(),
      opts: { identity: {} },
    })),
  }));
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.TWITCH_CHANNEL = 'channel';
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_CHANNEL_ID = '123';
  process.env.MUSIC_REWARD_ID = '545cc880-f6c1-4302-8731-29075a8a1f17';
  delete process.env.LOG_REWARD_IDS;
  delete process.env.TWITCH_OAUTH_TOKEN;
  const bot = require('../bot');
  jest.useRealTimers();
  return { bot, connectMock };
};

const createSupabase = (
  existingVotes,
  insertMock = jest.fn(() => Promise.resolve({ error: null }))
) => {
  return {
    from: jest.fn((table) => {
        if (table === 'votes') {
          return {
            select: jest.fn(() => {
              const final = Promise.resolve({ data: existingVotes, error: null });
              final.eq = jest.fn(() => final);
              return { eq: jest.fn(() => final) };
            }),
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
      if (table === 'bot_tokens') {
        return {
          select: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: 1,
                  access_token: 'token',
                  refresh_token: 'refresh',
                  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                },
                error: null,
              })
            ),
          })),
          update: jest.fn(() => Promise.resolve({ error: null })),
          insert: jest.fn(() => Promise.resolve({ error: null })),
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
  const supabase = {
    from: jest.fn((table) => {
      switch (table) {
        case 'polls':
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
        case 'settings':
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: { value: 1 }, error: null }))
              }))
            }))
          };
        case 'poll_games':
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: [{ games: { id: 10, name: 'Doom' } }], error: null }))
            }))
          };
        case 'votes':
          return {
            select: jest.fn(() => {
              const final = Promise.resolve({ data: existingVotes, error: null });
              final.eq = jest.fn(() => final);
              return { eq: jest.fn(() => final) };
            }),
            insert: insertMock,
          };
        case 'users': {
          const selectUsers = jest.fn(() => ({
            eq: jest.fn((col, value) => ({
              maybeSingle: jest.fn(() => {
                if (col === 'id' && existingUser && existingUser.id === value) {
                  return Promise.resolve({ data: existingUser, error: null });
                }
                if (col === 'twitch_login') {
                  return Promise.resolve({ data: existingUser, error: null });
                }
                return Promise.resolve({ data: null, error: null });
              }),
            })),
          }));
          let insertUsers = jest.fn();
          if (!existingUser) {
            const single = jest.fn(() => Promise.resolve({ data: insertedUser, error: null }));
            insertUsers = jest.fn(() => ({ select: jest.fn(() => ({ single })) }));
          }
          const updateUsers = jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null }))
          }));
          return { select: selectUsers, insert: insertUsers, update: updateUsers };
        }
        case 'log_rewards':
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
        case 'event_logs':
          return { insert: jest.fn() };
        case 'donationalerts_tokens':
          return {
            select: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') }))
                }))
              }))
            }))
          };
        case 'stream_chatters':
          return { upsert: jest.fn(() => Promise.resolve({ error: null })) };
        default:
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
      }
    })
  };
  return supabase;
};

const createSupabaseIntim = ({
  chatters = [{ user_id: 2, users: { username: 'target' } }],
  contexts = [{ variant_one: 'в кустах', variant_two: 'тайно' }],
  users = [
    { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
    { id: 2, username: 'target', twitch_login: 'target' },
  ],
} = {}) => {
  const usersTable = {
    select: jest.fn(() => ({
      eq: jest.fn((col, value) => ({
        maybeSingle: jest.fn(() => {
          const user = users.find((u) =>
            col === 'twitch_login' ? u.twitch_login === value : u.id === value
          );
          return Promise.resolve({ data: user || null, error: null });
        }),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: users[0], error: null })) })),
    })),
    update: jest.fn((data) => {
      const eq = jest.fn((col, value) => {
        usersTable.update.eqArgs.push([col, value]);
        usersTable.update.records.push({ data, id: value });
        return Promise.resolve({ error: null });
      });
      return { eq };
    }),
  };
  usersTable.update.eqArgs = [];
  usersTable.update.records = [];
  const eventLogsInsert = jest.fn();
  return {
    from: jest.fn((table) => {
      if (table === 'users') return usersTable;
      if (table === 'stream_chatters') {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          select: jest.fn(() => Promise.resolve({ data: chatters, error: null })),
        };
      }
      if (table === 'intim_contexts') {
        return {
          select: jest.fn(() => Promise.resolve({ data: contexts, error: null })),
        };
      }
      if (table === 'log_rewards') {
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
      }
      if (table === 'event_logs') {
        return { insert: eventLogsInsert };
      }
      if (table === 'donationalerts_tokens') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') })),
              })),
            })),
          })),
        };
      }
      return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
    }),
    usersTable,
    eventLogsInsert,
  };
};

const createSupabaseFirstMessage = () => {
  const users = [
    { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
    { id: 2, username: 'other', twitch_login: 'other', vote_limit: 1 },
  ];
  const chatters = {};
  const insert = jest.fn(() => Promise.resolve({ error: null }));
  return {
    from: jest.fn((table) => {
      if (table === 'users') {
        return {
          select: jest.fn((field) => ({
            eq: jest.fn((col, value) => ({
              maybeSingle: jest.fn(() => {
                const user =
                  col === 'twitch_login'
                    ? users.find((u) => u.twitch_login === value)
                    : users.find((u) => u.id === value);
                if (!user) return Promise.resolve({ data: null, error: null });
                if (field === '*') {
                  return Promise.resolve({ data: user, error: null });
                }
                return Promise.resolve({
                  data: { [field]: user[field] || 0 },
                  error: null,
                });
              }),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: users[0], error: null })),
            })),
          })),
          update: jest.fn((data) => ({
            eq: jest.fn((col, value) => {
              const user = users.find((u) => u.id === value);
              if (user) Object.assign(user, data);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }
      if (table === 'stream_chatters') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn((_, value) => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({
                  data:
                    value in chatters ? { message_count: chatters[value] } : null,
                  error: null,
                })
              ),
            })),
          })),
          upsert: jest.fn((row) => {
            chatters[row.user_id] = row.message_count;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'achievements') {
        const chain = { stat: null, threshold: null };
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn((_, val) => {
          if (chain.stat === null) chain.stat = val;
          else chain.threshold = val;
          return chain;
        });
        chain.maybeSingle = jest.fn(() =>
          Promise.resolve({
            data:
              chain.stat === 'first_message' && chain.threshold === 1
                ? { id: 100 }
                : null,
            error: null,
          })
        );
        return chain;
      }
      if (table === 'user_achievements') {
        const chain = { insert };
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.maybeSingle = jest.fn(() =>
          Promise.resolve({ data: null, error: null })
        );
        return chain;
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
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: null, error: new Error('no token') })
                ),
              })),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        insert: jest.fn(),
      };
    }),
    insert,
  };
};

const createSupabasePoceluy = ({
  chatters = [{ user_id: 2, users: { username: 'target' } }],
  contexts = [{ variant_two: 'осмелится', variant_three: 'страстно' }],
  users = [
    { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
    { id: 2, username: 'target', twitch_login: 'target' },
  ],
} = {}) => {
  const usersTable = {
    select: jest.fn(() => ({
      eq: jest.fn((col, value) => ({
        maybeSingle: jest.fn(() => {
          const user = users.find((u) =>
            col === 'twitch_login' ? u.twitch_login === value : u.id === value
          );
          return Promise.resolve({ data: user || null, error: null });
        }),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: users[0], error: null })) })),
    })),
    update: jest.fn((data) => {
      const eq = jest.fn((col, value) => {
        usersTable.update.eqArgs.push([col, value]);
        usersTable.update.records.push({ data, id: value });
        return Promise.resolve({ error: null });
      });
      return { eq };
    }),
  };
  usersTable.update.eqArgs = [];
  usersTable.update.records = [];
  const eventLogsInsert = jest.fn();
  return {
    from: jest.fn((table) => {
      if (table === 'users') return usersTable;
      if (table === 'stream_chatters') {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          select: jest.fn(() => Promise.resolve({ data: chatters, error: null })),
        };
      }
      if (table === 'poceluy_contexts') {
        return {
          select: jest.fn(() => Promise.resolve({ data: contexts, error: null })),
        };
      }
      if (table === 'log_rewards') {
        return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
      }
      if (table === 'event_logs') {
        return { insert: eventLogsInsert };
      }
      if (table === 'donationalerts_tokens') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('no token') })),
              })),
            })),
          })),
        };
      }
      return { select: jest.fn(() => Promise.resolve({ data: [], error: null })), insert: jest.fn() };
    }),
    usersTable,
    eventLogsInsert,
  };
};

describe('getBotToken', () => {
  test('returns null and skips connection when no token stored', async () => {
    const { bot, connectMock } = loadBotNoToken();
    const token = await bot.getBotToken();
    expect(token).toBeNull();
    expect(connectMock).not.toHaveBeenCalled();
  });
});

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

describe('message handler no args', () => {
  test('shows instructions when no game specified', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage([]);
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game', false);
    expect(say).toHaveBeenCalledWith(
      'channel',
      'Вы можете проголосовать за игру из списка командой !игра [Название игры]. Получить список игр - !игра список'
    );
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
    expect(say).toHaveBeenCalledWith('channel', 'Doom - 0');
  });

  test('reports remaining votes', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseMessage([
      { game_id: 1, games: { name: 'Doom' } },
    ]);
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(say).toHaveBeenCalledWith(
      'channel',
      '@user, у вас осталось 0 голосов. Вы проголосовали за: Doom (1).'
    );
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
      [
        { game_id: 1, games: { name: 'Doom' } },
        { game_id: 1, games: { name: 'Doom' } },
        { game_id: 2, games: { name: 'Quake' } },
      ],
      undefined,
      { existingUser: { id: 1, username: 'User', vote_limit: 5 } }
    );
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(say).toHaveBeenCalledWith(
      'channel',
      '@user, у вас осталось 2 голосов. Вы проголосовали за: Doom (2), Quake (1).'
    );
  });
});

describe('reward logging', () => {
  test('logs reward name when available', async () => {
    const rewardId = 'abc';
    const rewardName = 'Cool';
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const base = createSupabaseMessage([]);
    const baseFrom = base.from;
    const supabase = {
      ...base,
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return {
            select: jest.fn(() =>
              Promise.resolve({ data: [{ reward_id: rewardId }], error: null })
            ),
          };
        }
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        return baseFrom(table);
      }),
    };
    const on = jest.fn();
    loadBotWithOn(supabase, on);

    // wait for async reward fetch
    await new Promise(setImmediate);

    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: rewardId, title: rewardName }] }),
    });
    await messageHandler(
      'channel',
      { username: 'user', 'custom-reward-id': rewardId, 'display-name': 'User' },
      'Hello',
      false
    );
    fetchMock.mockRestore();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Reward ${rewardName} redeemed by User: Hello`,
        media_url: null,
        preview_url: null,
        title: null,
        type: null,
        created_at: expect.any(String),
      })
    );
  });

  test('falls back to ID when reward name fetch fails', async () => {
    const rewardId = 'abc';
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const base = createSupabaseMessage([]);
    const baseFrom = base.from;
    const supabase = {
      ...base,
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return {
            select: jest.fn(() =>
              Promise.resolve({ data: [{ reward_id: rewardId }], error: null })
            ),
          };
        }
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        return baseFrom(table);
      }),
    };
    const on = jest.fn();
    loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false });
    await messageHandler(
      'channel',
      { username: 'user', 'custom-reward-id': rewardId, 'display-name': 'User' },
      'Hello',
      false
    );
    global.fetch.mockRestore();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Reward ${rewardId} redeemed by User: Hello`,
        media_url: null,
        preview_url: null,
        title: null,
        type: null,
        created_at: expect.any(String),
      })
    );
  });

  test('logs media url and preview for music reward with valid youtube link', async () => {
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const base = createSupabaseMessage([]);
    const baseFrom = base.from;
    const supabase = {
      ...base,
      from: jest.fn((table) => {
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        return baseFrom(table);
      }),
    };
    const on = jest.fn();
    loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    const link = 'https://youtu.be/abc123';
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: 'Song' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ title: 'Music Reward' }] }),
    });
    await messageHandler(
      'channel',
      {
        username: 'user',
        'custom-reward-id': '545cc880-f6c1-4302-8731-29075a8a1f17',
        'display-name': 'User',
      },
      link,
      false
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Reward Music Reward redeemed by User: ${link}`,
        media_url: link,
        preview_url: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
        title: 'Song',
        type: null,
        created_at: expect.any(String),
      })
    );
    fetchMock.mockRestore();
  });

  test('warns and skips music reward with invalid link', async () => {
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const base = createSupabaseMessage([]);
    const baseFrom = base.from;
    const supabase = {
      ...base,
      from: jest.fn((table) => {
        if (table === 'event_logs') {
          return { insert: insertMock };
        }
        return baseFrom(table);
      }),
    };
    const on = jest.fn();
    const say = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    const link = 'https://example.com/video';
    await messageHandler(
      'channel',
      {
        'custom-reward-id': '545cc880-f6c1-4302-8731-29075a8a1f17',
        'display-name': 'User',
        username: 'user',
      },
      link,
      false
    );
    expect(insertMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Invalid YouTube URL', link);
    expect(say).toHaveBeenCalledWith('channel', '@user, invalid YouTube link.');
    consoleSpy.mockRestore();
  });

  test('increments vote_limit when extra vote reward is redeemed', async () => {
    const rewardId = 'e776c465-7f7a-4a41-8593-68165248ecd8';
    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const say = jest.fn();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler(
      'channel',
      { username: 'user', 'custom-reward-id': rewardId, 'display-name': 'User' },
      'Hello',
      false
    );
    const userUpdates = supabase.from.mock.results
      .map((r) => r.value)
      .filter((v) => v && v.update)
      .flatMap((v) => v.update.mock.calls.map((c) => c[0]));
    expect(userUpdates).toContainEqual({ vote_limit: 2 });
    expect(say).toHaveBeenCalledWith(
      'channel',
      '@user, вам добавлен дополнительный голос.'
    );
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

    expect(insertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: 'Donation from Alice: 10 USD',
        media_url: null,
        preview_url: null,
        title: null,
        type: null,
        created_at: expect.any(String),
      })
    );
    expect(insertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: 'Donation from Bob: 5 USD',
        media_url: 'http://clip',
        preview_url: null,
        title: null,
        type: null,
        created_at: expect.any(String),
      })
    );
    expect(insertMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        message: 'Donation from Carol: 7 USD',
        media_url: 'https://youtu.be/abc123',
        preview_url: expect.stringContaining('img.youtube.com'),
        title: null,
        type: null,
        created_at: expect.any(String),
      })
    );

    global.fetch.mockRestore();
  });
});

describe('!интим', () => {
  test('logs event with detailed type', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим',
      false
    );
    Math.random.mockRestore();
    expect(supabase.eventLogsInsert).toHaveBeenCalledTimes(1);
    const logged = supabase.eventLogsInsert.mock.calls[0][0];
    expect(logged).toEqual(
      expect.objectContaining({
        message: '0% шанс того, что у @author в кустах будет интим с @target',
        media_url: null,
        preview_url: null,
        title: null,
        type: 'intim_no_tag_0',
        created_at: expect.any(String),
      })
    );
    const created = new Date(logged.created_at).getTime();
    expect(created).toBeLessThan(Date.now() + 5000);
    expect(created).toBeGreaterThan(Date.now() - 5000);
  });
  test('без тега выводит шанс для автора', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler('channel', { username: 'author', 'display-name': 'Author' }, '!интим', false);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что у @author в кустах будет интим с @target'
    );
    Math.random.mockRestore();
  });

  test('с тегом выводит шанс для пары с случайным партнером', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим @target',
      false
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что @author тайно @target интимиться с @partner в кустах'
    );
    Math.random.mockRestore();
  });

  test('при выборе автора без тега сообщение корректно', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим',
      false
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что у @author в кустах будет интим с @author'
    );
    Math.random.mockRestore();
  });

  test('при выборе автора с тегом сообщение корректно', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим @target',
      false
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что @author тайно @target интимиться с @author в кустах'
    );
    Math.random.mockRestore();
  });

  test('increments intim_self_no_tag when author chosen without tag', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим',
      false
    );
    Math.random.mockRestore();
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'intim_self_no_tag')
      )
    ).toBe(true);
  });

  test('increments intim_self_with_tag when author tags someone', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим @someone',
      false
    );
    Math.random.mockRestore();
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'intim_self_with_tag')
      )
    ).toBe(true);
  });

  test('increments counters for tag match on both users', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // select partner
      .mockReturnValueOnce(0.5) // select context
      .mockReturnValueOnce(0.69); // percent 69
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим @partner',
      false
    );
    Math.random.mockRestore();

    const updates = supabase.usersTable.update.records;

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ intim_tag_match_success: 1 }),
        }),
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ intim_tag_match_success_69: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ intim_tagged_equals_partner: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ intim_tagged_equals_partner_69: 1 }),
        }),
      ])
    );
  });
});

describe('!поцелуй', () => {
  test('logs event with detailed type', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй',
      false
    );
    Math.random.mockRestore();
    expect(supabase.eventLogsInsert).toHaveBeenCalledTimes(1);
    const logged = supabase.eventLogsInsert.mock.calls[0][0];
    expect(logged).toEqual(
      expect.objectContaining({
        message: '0% шанс того, что у @author страстно поцелует @target',
        media_url: null,
        preview_url: null,
        title: null,
        type: 'poceluy_no_tag_0',
        created_at: expect.any(String),
      })
    );
    const created = new Date(logged.created_at).getTime();
    expect(created).toBeLessThan(Date.now() + 5000);
    expect(created).toBeGreaterThan(Date.now() - 5000);
  });
  test('без тега выводит шанс для автора', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler('channel', { username: 'author', 'display-name': 'Author' }, '!поцелуй', false);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что у @author страстно поцелует @target'
    );
    Math.random.mockRestore();
  });

  test('с тегом выводит шанс для пары с случайным партнером', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @target',
      false
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что @author осмелится @target поцелует @partner страстно'
    );
    Math.random.mockRestore();
  });

  test('при выборе автора без тега сообщение корректно', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй',
      false
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что у @author страстно поцелует @author'
    );
    Math.random.mockRestore();
  });

  test('при выборе автора с тегом сообщение корректно', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @target',
      false
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe(
      '50% шанс того, что @author осмелится @target поцелует @author страстно'
    );
    Math.random.mockRestore();
  });

  test('increments poceluy_self_no_tag when author chosen without tag', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй',
      false
    );
    Math.random.mockRestore();
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'poceluy_self_no_tag')
      )
    ).toBe(true);
  });

  test('increments poceluy_self_with_tag when author tags someone', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @someone',
      false
    );
    Math.random.mockRestore();
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'poceluy_self_with_tag')
      )
    ).toBe(true);
  });

  test('increments counters for tag match on both users', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // select partner
      .mockReturnValueOnce(0.5) // select context
      .mockReturnValueOnce(0.69); // percent 69
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @partner',
      false
    );
    Math.random.mockRestore();

    const updates = supabase.usersTable.update.records;

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ poceluy_tag_match_success: 1 }),
        }),
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ poceluy_tag_match_success_69: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ poceluy_tagged_equals_partner: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ poceluy_tagged_equals_partner_69: 1 }),
        }),
      ])
    );
  });

  test('increments tag match success counters for 0 percent', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // select partner
      .mockReturnValueOnce(0.5) // select context
      .mockReturnValueOnce(0); // percent 0
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @partner',
      false
    );
    Math.random.mockRestore();

    const updates = supabase.usersTable.update.records;

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ poceluy_tag_match_success: 1 }),
        }),
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ poceluy_tag_match_success_0: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ poceluy_tagged_equals_partner: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ poceluy_tagged_equals_partner_0: 1 }),
        }),
      ])
    );
  });

  test('increments tag match success counters for 100 percent', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // select partner
      .mockReturnValueOnce(0.5) // select context
      .mockReturnValueOnce(0.995); // percent 100
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @partner',
      false
    );
    Math.random.mockRestore();

    const updates = supabase.usersTable.update.records;

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ poceluy_tag_match_success: 1 }),
        }),
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ poceluy_tag_match_success_100: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ poceluy_tagged_equals_partner: 1 }),
        }),
        expect.objectContaining({
          id: 2,
          data: expect.objectContaining({ poceluy_tagged_equals_partner_100: 1 }),
        }),
      ])
    );
  });
});

describe('!clip', () => {
  test('increments clips_created stat on success', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseIntim();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'clip1' }] }) })
    );

    await handler('channel', { username: 'author', 'display-name': 'Author' }, '!clip', false);

    expect(
      supabase.usersTable.update.records.some(
        (r) => r.id === 1 && r.data.clips_created === 1
      )
    ).toBe(true);

    global.fetch.mockRestore();
  });
});

describe('first message achievement', () => {
  test('awards only once per stream', async () => {
    const on = jest.fn();
    const say = jest.fn();
    const supabase = createSupabaseFirstMessage();
    loadBotWithOn(supabase, on, say);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];

    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      'hello',
      false
    );

    await handler(
      'channel',
      { username: 'other', 'display-name': 'Other' },
      'hi',
      false
    );

    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(supabase.insert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ user_id: 1, achievement_id: 100 })
    );
  });
});

describe('applyRandomPlaceholders', () => {
  test('replaces [от 3 до 10] and [random_chatter] placeholders', async () => {
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'stream_chatters') {
          return {
            select: jest.fn(() =>
              Promise.resolve({
                data: [{ users: { username: 'target' } }],
                error: null,
              })
            ),
          };
        }
        return {
          select: jest.fn(() => Promise.resolve({ data: [], error: null })),
          insert: jest.fn(),
        };
      }),
    };
    const { applyRandomPlaceholders } = loadBot(supabase);

    const context = '[random_chatter] появится через [от 3 до 10] минут';
    const result = await applyRandomPlaceholders(context, supabase);
    const match = result.match(/^@target появится через (\d+) минут$/);
    expect(match).not.toBeNull();
    const num = parseInt(match[1], 10);
    expect(num).toBeGreaterThanOrEqual(3);
    expect(num).toBeLessThanOrEqual(10);
  });
});
