const streamerBotChatActions = require('../../shared/streamerBotChatActions');
const { commandHandlers } = require('../commands');
const { createPollService, createUserService } = require('../services/db');
const {
  WHAT_FALLBACK_ACTIONS,
  WHERETO_FALLBACK_DESTINATIONS,
} = require('../services/ai');
const { parseCommand } = require('../handlers/utils');

const chatActionEntries = Object.entries(streamerBotChatActions);

describe('commandHandlers', () => {
  test('registers core chat commands', () => {
    const expected = [
      '!где',
      '!когда',
      '!что',
      '!куда',
      '!кто',
      '!clip',
      '!интим',
      '!поцелуй',
    ];
    expected.forEach((command) => {
      expect(commandHandlers.has(command)).toBe(true);
    });
  });
});

function configureChatActionEnv() {
  for (const [key, envName] of chatActionEntries) {
    process.env[envName] = `action-${key}`;
  }
}

function configureBaseEnv() {
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.TWITCH_CHANNEL = 'channel';
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_CHANNEL_ID = '123';
  process.env.TOGETHER_API_KEY = 'test-together-key';
  process.env.MUSIC_REWARD_ID = '545cc880-f6c1-4302-8731-29075a8a1f17';
  configureChatActionEnv();
}

function setupStreamerBotMock() {
  const { createStreamerBotIntegration } = jest.requireActual(
    '../streamerBotClient'
  );
  const streamerBotHandlers = jest.requireActual('../streamerBotHandlers');
  const fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    })
  );

  const integration = createStreamerBotIntegration({
    baseUrl: 'http://localhost:7478',
    actions: {
      intim: process.env.STREAMERBOT_INTIM_ACTION,
      poceluy: process.env.STREAMERBOT_POCELUY_ACTION,
    },
    handlers: streamerBotHandlers,
    fetchImpl: fetchMock,
  });

  jest.spyOn(integration.client, 'triggerAction');

  const streamerBotMock = {
    ...integration,
    client: integration.client,
    triggerActionOriginal: integration.client.triggerAction.bind(
      integration.client
    ),
    triggerAction: jest.fn((...args) =>
      integration.client.triggerAction(...args)
    ),
    triggerIntim: jest.fn((payload = {}) => integration.triggerIntim(payload)),
    triggerPoceluy: jest.fn((payload = {}) =>
      integration.triggerPoceluy(payload)
    ),
  };
  jest.doMock('../streamerBotClient', () => ({
    createStreamerBotIntegration: jest.fn(() => streamerBotMock),
  }));
  return streamerBotMock;
}

function mockTmi(onMock = jest.fn()) {
  const client = {
    connect: jest.fn(() => Promise.resolve()),
    on: onMock,
  };
  jest.doMock('tmi.js', () => ({
    Client: jest.fn(() => client),
  }));
  return client;
}

function mockSupabaseFactory(mockSupabase) {
  const originalFrom = mockSupabase.from;
  mockSupabase.from = jest.fn((table) => {
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
  return originalFrom;
}

function ensureFetchMock() {
  const defaultFetchImpl = () =>
    Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
  if (typeof global.fetch !== 'function') {
    global.fetch = jest.fn(defaultFetchImpl);
  } else if (!global.fetch._isMockFunction) {
    jest.spyOn(global, 'fetch').mockImplementation(defaultFetchImpl);
  }
}

function getChatActionId(key) {
  const envName = streamerBotChatActions[key];
  if (!envName) {
    throw new Error(`Unknown chat action key: ${key}`);
  }
  return process.env[envName];
}

function expectChatAction(streamerBotMock, key, matcher) {
  const actionId = getChatActionId(key);
  const call = streamerBotMock.triggerAction.mock.calls.find(
    ([id]) => id === actionId
  );
  expect(call).toBeDefined();
  const payload = call[1] || {};
  expect(payload).toEqual(expect.objectContaining(matcher));
}

async function dispatchMessage({
  supabase,
  message,
  tags,
  on = jest.fn(),
  self = false,
}) {
  const { streamerBotMock } = loadBotWithOn(supabase, on);
  await new Promise(setImmediate);
  const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
  await messageHandler('channel', tags, message, self);
  return { streamerBotMock, on };
}

const loadBot = (mockSupabase) => {
  jest.resetModules();
  jest.useFakeTimers();
  const streamerBotMock = setupStreamerBotMock();
  mockTmi();
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  mockSupabaseFactory(mockSupabase);
  configureBaseEnv();
  ensureFetchMock();
  const bot = require('../bot');
  jest.useRealTimers();
  return { bot, streamerBotMock };
};

const loadBotWithOn = (mockSupabase, onMock) => {
  jest.resetModules();
  jest.useFakeTimers();
  const streamerBotMock = setupStreamerBotMock();
  const tmiClient = mockTmi(onMock);
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }));
  mockSupabaseFactory(mockSupabase);
  configureBaseEnv();
  delete process.env.LOG_REWARD_IDS;
  ensureFetchMock();
  const bot = require('../bot');
  jest.useRealTimers();
  return { bot, streamerBotMock, tmiClient };
};

const createEventLogsTable = (
  insertMock = jest.fn(() => Promise.resolve({ error: null })),
  maybeSingleImpl = () => Promise.resolve({ data: null, error: null })
) => ({
  insert: insertMock,
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      order: jest.fn(() => ({
        limit: jest.fn(() => ({ maybeSingle: jest.fn(maybeSingleImpl) })),
      })),
    })),
  })),
});

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
      return {
        select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        insert: jest.fn(),
      };
    }),
  };
};

const createSupabaseUsers = (existingUser, insertedUser) => {
  const users = existingUser ? [existingUser] : [];
  const findByField = (field, value) => {
    const normalizedValue = String(value || '').toLowerCase();
    return (
      users.find(
        (u) =>
          typeof u[field] === 'string' && u[field].toString().toLowerCase() === normalizedValue
      ) || null
    );
  };

  const maybeSingleFactory = (field, value) =>
    jest.fn(() => Promise.resolve({ data: findByField(field, value), error: null }));

  const eq = jest.fn((field, value) => ({ maybeSingle: maybeSingleFactory(field, value) }));
  const ilike = jest.fn((field, value) => ({ maybeSingle: maybeSingleFactory(field, value) }));
  const selectUsers = jest.fn(() => ({ eq, ilike }));

  const insertSingle = jest.fn(() => {
    const data = insertedUser || {
      id: users.length + 1,
      ...lastInsert,
    };
    users.push(data);
    return Promise.resolve({ data, error: null });
  });
  const insertSelect = jest.fn(() => ({ single: insertSingle }));
  let lastInsert = null;
  const insertUsers = jest.fn((payload) => {
    lastInsert = payload;
    return { select: insertSelect };
  });

  const updateUsers = jest.fn((payload) => ({
    eq: jest.fn((field, value) => ({
      select: jest.fn(() => ({
        single: jest.fn(() => {
          const index = users.findIndex((u) => u[field] === value);
          if (index !== -1) {
            users[index] = { ...users[index], ...payload };
            return Promise.resolve({ data: users[index], error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      })),
    })),
  }));

  return {
    from: jest.fn((table) => {
      if (table === 'users') {
        return { select: selectUsers, insert: insertUsers, update: updateUsers };
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
    eq,
    ilike,
    insertUsers,
  };
};

const createSupabaseMessage = (
  existingVotes,
  insertMock = jest.fn(() => Promise.resolve({ error: null })),
  {
    existingUser = { id: 1, username: 'User', vote_limit: 1 },
    insertedUser,
    whereChatters = [
      { users: { username: 'Глеб' } },
      { users: { username: 'Марина' } },
    ],
    pollGames = [{ id: 10, name: 'Doom' }],
  } = {}
) => {
  const pollGamesData = pollGames.map((game) => ({
    game_id: game.id,
    games: { id: game.id, name: game.name },
  }));
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
              eq: jest.fn(() => Promise.resolve({ data: pollGamesData, error: null }))
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
            ilike: jest.fn((col, value) => ({
              maybeSingle: jest.fn(() => {
                const normalized = String(value || '').toLowerCase();
                if (
                  col === 'twitch_login' &&
                  existingUser &&
                  (existingUser.twitch_login || '').toLowerCase() === normalized
                ) {
                  return Promise.resolve({ data: existingUser, error: null });
                }
                if (
                  col === 'username' &&
                  existingUser &&
                  (existingUser.username || '').toLowerCase() === normalized
                ) {
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
          const updateUsers = jest.fn((data) => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({ data: { ...existingUser, ...data }, error: null })
                ),
              })),
            })),
          }));
          return { select: selectUsers, insert: insertUsers, update: updateUsers };
        }
        case 'log_rewards':
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
        case 'event_logs':
          return createEventLogsTable();
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
          return {
            upsert: jest.fn(() => Promise.resolve({ error: null })),
            select: jest.fn(() =>
              Promise.resolve({ data: whereChatters, error: null })
            ),
          };
        case 'achievements': {
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
        case 'user_achievements': {
          const insert = jest.fn(() => Promise.resolve({ error: null }));
          const chain = { insert };
          chain.select = jest.fn(() => chain);
          chain.eq = jest.fn(() => chain);
          chain.maybeSingle = jest.fn(() =>
            Promise.resolve({ data: null, error: null })
          );
          return chain;
        }
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
          const normalized = String(value || '').toLowerCase();
          const user = users.find((u) =>
            col === 'twitch_login'
              ? (u.twitch_login || '').toLowerCase() === normalized
              : u.id === value
          );
          return Promise.resolve({ data: user || null, error: null });
        }),
      })),
      ilike: jest.fn((col, value) => ({
        maybeSingle: jest.fn(() => {
          const normalized = String(value || '').toLowerCase();
          const user = users.find((u) =>
            col === 'twitch_login'
              ? (u.twitch_login || '').toLowerCase() === normalized
              : (u.username || '').toLowerCase() === normalized
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
        return {
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { ...users[0], ...data }, error: null })),
          })),
        };
      });
      return { eq };
    }),
  };
  usersTable.update.eqArgs = [];
  usersTable.update.records = [];
  const eventLogsInsert = jest.fn();
  const userAchievementsInsert = jest.fn(() => Promise.resolve({ error: null }));
  return {
    from: jest.fn((table) => {
      if (table === 'users') return usersTable;
      if (table === 'stream_chatters') {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          select: jest.fn(() => Promise.resolve({ data: chatters, error: null })),
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
        const chain = { insert: userAchievementsInsert };
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.maybeSingle = jest.fn(() =>
          Promise.resolve({ data: null, error: null })
        );
        return chain;
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
        return createEventLogsTable(eventLogsInsert);
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
    userAchievementsInsert,
  };
};

const createSupabaseFirstMessage = () => {
  const users = [
    {
      id: 1,
      username: 'author',
      twitch_login: 'author',
      vote_limit: 1,
      affinity: 0,
    },
    {
      id: 2,
      username: 'other',
      twitch_login: 'other',
      vote_limit: 1,
      affinity: 0,
    },
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
            ilike: jest.fn((col, value) => ({
              maybeSingle: jest.fn(() => {
                const normalized = String(value || '').toLowerCase();
                const user = users.find((u) =>
                  col === 'twitch_login'
                    ? (u.twitch_login || '').toLowerCase() === normalized
                    : (u.username || '').toLowerCase() === normalized
                );
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
          delete: jest.fn(() => ({
            neq: jest.fn(() => Promise.resolve({ error: null })),
          })),
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
        return createEventLogsTable();
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
          const normalized = String(value || '').toLowerCase();
          const user = users.find((u) =>
            col === 'twitch_login'
              ? (u.twitch_login || '').toLowerCase() === normalized
              : u.id === value
          );
          return Promise.resolve({ data: user || null, error: null });
        }),
      })),
      ilike: jest.fn((col, value) => ({
        maybeSingle: jest.fn(() => {
          const normalized = String(value || '').toLowerCase();
          const user = users.find((u) =>
            col === 'twitch_login'
              ? (u.twitch_login || '').toLowerCase() === normalized
              : (u.username || '').toLowerCase() === normalized
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
        return {
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { ...users[0], ...data }, error: null })),
          })),
        };
      });
      return { eq };
    }),
  };
  usersTable.update.eqArgs = [];
  usersTable.update.records = [];
  const eventLogsInsert = jest.fn();
  const userAchievementsInsert = jest.fn(() => Promise.resolve({ error: null }));
  return {
    from: jest.fn((table) => {
      if (table === 'users') return usersTable;
      if (table === 'stream_chatters') {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          select: jest.fn(() => Promise.resolve({ data: chatters, error: null })),
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
        const chain = { insert: userAchievementsInsert };
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.maybeSingle = jest.fn(() =>
          Promise.resolve({ data: null, error: null })
        );
        return chain;
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
        return createEventLogsTable(eventLogsInsert);
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
    userAchievementsInsert,
  };
};

describe('parseCommand', () => {
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
    const existing = {
      id: 1,
      username: 'Display',
      twitch_login: 'login',
      affinity: 0,
    };
    const mock = createSupabaseUsers(existing);
    const userService = createUserService({
      supabase: mock,
      getTwitchToken: jest.fn(),
      getStreamerToken: jest.fn(),
      twitchConfig: {},
    });
    const user = await userService.findOrCreateUser({
      username: 'Login',
      'display-name': 'Display',
    });
    expect(mock.ilike).toHaveBeenCalledWith('twitch_login', 'login');
    expect(mock.insertUsers).not.toHaveBeenCalled();
    expect(user).toEqual(existing);
  });

  test('creates new user with username and lowercase twitch_login', async () => {
    const inserted = {
      id: 2,
      username: 'Display',
      twitch_login: 'login',
      affinity: 0,
      user_facts: {},
    };
    const mock = createSupabaseUsers(null, inserted);
    const userService = createUserService({
      supabase: mock,
      getTwitchToken: jest.fn(),
      getStreamerToken: jest.fn(),
      twitchConfig: {},
    });
    const user = await userService.findOrCreateUser({
      username: 'LoGin',
      'display-name': 'Display',
    });
    expect(mock.ilike).toHaveBeenCalledWith('twitch_login', 'login');
    expect(mock.insertUsers).toHaveBeenCalledWith({
      username: 'Display',
      twitch_login: 'login',
      affinity: 0,
      user_facts: {},
    });
    expect(user).toEqual(inserted);
  });

  test('reuses existing user when username casing changes', async () => {
    const inserted = {
      id: 3,
      username: 'Display',
      twitch_login: 'login',
      affinity: 0,
    };
    const mock = createSupabaseUsers(null, inserted);
    const userService = createUserService({
      supabase: mock,
      getTwitchToken: jest.fn(),
      getStreamerToken: jest.fn(),
      twitchConfig: {},
    });

    await userService.findOrCreateUser({
      username: 'LoGin',
      'display-name': 'Display',
    });
    const user = await userService.findOrCreateUser({
      username: 'login',
      'display-name': 'display',
    });

    expect(mock.insertUsers).toHaveBeenCalledTimes(1);
    expect(user).toEqual(inserted);
  });
});

describe('addVote', () => {
  test('inserts vote in first slot', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = createSupabase([], insert);
    const pollService = createPollService({ supabase });
    const res = await pollService.addVote({ id: 1, vote_limit: 2 }, 5, 10);
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
    const pollService = createPollService({ supabase });
    const res = await pollService.addVote({ id: 1, vote_limit: 1 }, 5, 10);
    expect(res).toEqual({ success: false, reason: 'vote limit reached' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('returns db error on insert failure', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: new Error('fail') }));
    const supabase = createSupabase([], insert);
    const pollService = createPollService({ supabase });
    const res = await pollService.addVote({ id: 1, vote_limit: 1 }, 5, 10);
    expect(res).toEqual({ success: false, reason: 'db error' });
  });
});

describe('message handler no args', () => {
  test('shows instructions when no game specified', async () => {
    const on = jest.fn();
    const supabase = createSupabaseMessage([]);
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollHelp', {
      message:
        'Вы можете проголосовать за игру из списка командой !игра [Название игры или номер]. Получить список игр - !игра список',
      initiator: 'user',
      type: 'info',
    });
  });
});

describe('!где', () => {
  let originalFetch;
  let originalRandom;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalRandom = Math.random;
  });

  afterEach(() => {
    if (global.fetch && global.fetch !== originalFetch) {
      if (typeof global.fetch.mockRestore === 'function') {
        global.fetch.mockRestore();
      }
    }
    global.fetch = originalFetch;
    Math.random = originalRandom;
  });

  test('requests Together.ai and triggers where result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'в баре' } }],
        }),
      })
    );
    global.fetch = fetchMock;

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!где Катя',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const [, options] = togetherCall;
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-together-key');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo');
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.8);
    expect(body.top_p).toBe(0.9);
    expect(body.messages[0]).toEqual(
      expect.objectContaining({ role: 'system' })
    );
    expect(body.messages[0].content).toContain('атмосферные детали');
    expect(body.messages[1]).toEqual(
      expect.objectContaining({ role: 'user' })
    );
    expect(body.messages[1].content).toContain('$whereuser=Катя');
    expect(body.messages[1].content).toContain('@Глеб');
    expect(body.messages[1].content).toContain('Не упоминай Катя');
    expectChatAction(streamerBotMock, 'whereResult', {
      message: 'Катя в баре',
      initiator: 'user',
      type: 'where',
    });
  });

  test('falls back when Together.ai request rejects', async () => {
    const fetchMock = jest.fn(() => Promise.reject(new Error('fail')));
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.2);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!где',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const actionId = getChatActionId('whereResult');
    const call = streamerBotMock.triggerAction.mock.calls.find(
      ([id]) => id === actionId
    );
    expect(call).toBeDefined();
    const payload = call[1];
    expect(payload.initiator).toBe('user');
    expect(payload.type).toBe('where');
    expect(payload.target).toBeNull();
    expect(payload.message.startsWith('@user ')).toBe(true);
    const location = payload.message.replace(/^@user\s+/, '');
    const fallbackPool = [
      'в баре',
      'на кухне',
      'в метро',
      'в библиотеке',
      'на стриме',
      'в парке',
      'в кино',
      'в космосе',
      'под мостом',
      'на крыше небоскрёба',
      'в поезде-призраке',
      'в секретной оранжерее',
      'в закулисье цирка',
      'в ретро-аркаде',
      'на заброшенном пирсе',
      'в чайной на колёсах',
    ];
    expect(fallbackPool).toContain(location);
  });

  test('falls back when Together.ai returns empty result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ choices: [] }),
      })
    );
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.95);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!где Вася',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    expectChatAction(streamerBotMock, 'whereResult', {
      message: 'Вася в чайной на колёсах',
      initiator: 'user',
      type: 'where',
    });
  });

  test('avoids repeating the same location twice in a row', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'в метро' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'в метро' } }],
        }),
      });
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];

    await messageHandler('channel', { username: 'user' }, '!где Катя', false);
    await messageHandler('channel', { username: 'user' }, '!где Катя', false);

    const actionId = getChatActionId('whereResult');
    const calls = streamerBotMock.triggerAction.mock.calls.filter(
      ([id]) => id === actionId
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][1].message).toBe('Катя в метро');
    expect(calls[1][1].message).toBe('Катя в баре');
  });
});

describe('!когда', () => {
  let originalFetch;
  let originalRandom;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalRandom = Math.random;
  });

  afterEach(() => {
    if (global.fetch && global.fetch !== originalFetch) {
      if (typeof global.fetch.mockRestore === 'function') {
        global.fetch.mockRestore();
      }
    }
    global.fetch = originalFetch;
    Math.random = originalRandom;
  });

  test('requests Together.ai and triggers when result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'через пять минут' } }],
        }),
      })
    );
    global.fetch = fetchMock;

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!когда Катя',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const [, options] = togetherCall;
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-together-key');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo');
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.8);
    expect(body.top_p).toBe(0.9);
    expect(body.messages[0]).toEqual(
      expect.objectContaining({ role: 'system' })
    );
    expect(body.messages[0].content).toContain('атмосферные детали');
    expect(body.messages[1]).toEqual(
      expect.objectContaining({ role: 'user' })
    );
    expect(body.messages[1].content).toContain('$whenuser=Катя');
    expect(body.messages[1].content).toContain('Не повторяй имя Катя');
    expectChatAction(streamerBotMock, 'whenResult', {
      message: 'Катя через пять минут',
      initiator: 'user',
      type: 'when',
    });
  });

  test('falls back when Together.ai request rejects', async () => {
    const fetchMock = jest.fn(() => Promise.reject(new Error('fail')));
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.2);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!когда',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const actionId = getChatActionId('whenResult');
    const call = streamerBotMock.triggerAction.mock.calls.find(
      ([id]) => id === actionId
    );
    expect(call).toBeDefined();
    const payload = call[1];
    expect(payload.initiator).toBe('user');
    expect(payload.type).toBe('when');
    expect(payload.target).toBeNull();
    expect(payload.message.startsWith('@user ')).toBe(true);
    const time = payload.message.replace(/^@user\s+/, '');
    const fallbackPool = [
      'через пять минут',
      'после полуночи',
      'перед первым кофе',
      'когда чат зевнёт в унисон',
      'к следующему полнолунию',
      'как только гусь в чате крикнет',
      'через три песни на фоновой волне',
      'в воскресенье ближе к сумеркам',
      'когда донаты станцуют польку',
      'вторник ровно в 19:07',
      'по окончании следующего раунда',
      'пока чайник не свистнет трижды',
      'как только выпадет редкий дроп',
      'на рассвете со звуком уведомлений',
      'в полночь по времени стримера',
      'когда чат договорится об эмоте',
    ];
    expect(fallbackPool).toContain(time);
  });

  test('falls back when Together.ai returns empty result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ choices: [] }),
      })
    );
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.95);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!когда Вася',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    expectChatAction(streamerBotMock, 'whenResult', {
      message: 'Вася когда чат договорится об эмоте',
      initiator: 'user',
      type: 'when',
    });
  });

  test('avoids repeating the same time twice in a row', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'после полуночи' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'после полуночи' } }],
        }),
      });
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];

    await messageHandler('channel', { username: 'user' }, '!когда Катя', false);
    await messageHandler('channel', { username: 'user' }, '!когда Катя', false);

    const actionId = getChatActionId('whenResult');
    const calls = streamerBotMock.triggerAction.mock.calls.filter(
      ([id]) => id === actionId
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][1].message).toBe('Катя после полуночи');
    expect(calls[1][1].message).toBe('Катя через пять минут');
  });
});

describe('!что', () => {
  let originalFetch;
  let originalRandom;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalRandom = Math.random;
  });

  afterEach(() => {
    if (global.fetch && global.fetch !== originalFetch) {
      if (typeof global.fetch.mockRestore === 'function') {
        global.fetch.mockRestore();
      }
    }
    global.fetch = originalFetch;
    Math.random = originalRandom;
  });

  test('requests Together.ai and triggers what result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'жонглирует донатами' } }],
        }),
      })
    );
    global.fetch = fetchMock;

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!что Катя',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const [, options] = togetherCall;
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-together-key');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo');
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.8);
    expect(body.top_p).toBe(0.9);
    expect(body.messages[0]).toEqual(
      expect.objectContaining({ role: 'system' })
    );
    expect(body.messages[0].content).toContain('команду !что');
    expect(body.messages[1]).toEqual(
      expect.objectContaining({ role: 'user' })
    );
    expect(body.messages[1].content).toContain('$whatuser=Катя');
    expect(body.messages[1].content).toContain('Избегай повторов');
    expect(body.messages[1].content).toContain('@Глеб');
    expect(body.messages[1].content).toContain('Не упоминай Катя');
    expectChatAction(streamerBotMock, 'whatResult', {
      message: 'Катя жонглирует донатами',
      initiator: 'user',
      type: 'what',
    });
  });

  test('falls back when Together.ai request rejects', async () => {
    const fetchMock = jest.fn(() => Promise.reject(new Error('fail')));
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.2);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!что',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const actionId = getChatActionId('whatResult');
    const call = streamerBotMock.triggerAction.mock.calls.find(
      ([id]) => id === actionId
    );
    expect(call).toBeDefined();
    const payload = call[1];
    expect(payload.initiator).toBe('user');
    expect(payload.type).toBe('what');
    expect(payload.target).toBeNull();
    expect(payload.message.startsWith('@user ')).toBe(true);
    const action = payload.message.replace(/^@user\s+/, '');
    expect(WHAT_FALLBACK_ACTIONS).toContain(action);
  });

  test('falls back when Together.ai returns empty result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ choices: [] }),
      })
    );
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.95);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!что Вася',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    expectChatAction(streamerBotMock, 'whatResult', {
      message: 'Вася остылый энергетик',
      initiator: 'user',
      type: 'what',
    });
  });

  test('avoids repeating the same action twice in a row', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'жонглирует обрезанными клипами' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'жонглирует обрезанными клипами' } }],
        }),
      });
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];

    await messageHandler('channel', { username: 'user' }, '!что Катя', false);
    await messageHandler('channel', { username: 'user' }, '!что Катя', false);

    const actionId = getChatActionId('whatResult');
    const calls = streamerBotMock.triggerAction.mock.calls.filter(
      ([id]) => id === actionId
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][1].message).toBe('Катя жонглирует обрезанными клипами');
    expect(calls[1][1].message).toBe('Катя пицца с ананасами');
  });
});

describe('!куда', () => {
  let originalFetch;
  let originalRandom;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalRandom = Math.random;
  });

  afterEach(() => {
    if (global.fetch && global.fetch !== originalFetch) {
      if (typeof global.fetch.mockRestore === 'function') {
        global.fetch.mockRestore();
      }
    }
    global.fetch = originalFetch;
    Math.random = originalRandom;
  });

  test('requests Together.ai and triggers where-to result', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'улетает на марс' } }],
        }),
      })
    );
    global.fetch = fetchMock;

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!куда Катя',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const [, options] = togetherCall;
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-together-key');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo');
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.8);
    expect(body.top_p).toBe(0.9);
    expect(body.messages[0]).toEqual(
      expect.objectContaining({ role: 'system' })
    );
    expect(body.messages[0].content).toContain('команду !куда');
    expect(body.messages[1]).toEqual(
      expect.objectContaining({ role: 'user' })
    );
    expect(body.messages[1].content).toContain('$wheretouser=Катя');
    expect(body.messages[1].content).toContain('Избегай повторов');
    expect(body.messages[1].content).toContain('@Глеб');
    expect(body.messages[1].content).toContain('Не упоминай Катя');
    expectChatAction(streamerBotMock, 'whereToResult', {
      message: 'Катя улетает на марс',
      initiator: 'user',
      type: 'whereTo',
    });
  });

  test('falls back when Together.ai request rejects', async () => {
    const fetchMock = jest.fn(() => Promise.reject(new Error('fail')));
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0.65);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!куда',
      tags: { username: 'user' },
      on,
    });

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const actionId = getChatActionId('whereToResult');
    const call = streamerBotMock.triggerAction.mock.calls.find(
      ([id]) => id === actionId
    );
    expect(call).toBeDefined();
    const payload = call[1];
    expect(payload.initiator).toBe('user');
    expect(payload.type).toBe('whereTo');
    expect(payload.target).toBeNull();
    expect(payload.message.startsWith('@user ')).toBe(true);
    const destination = payload.message.replace(/^@user\s+/, '');
    expect(WHERETO_FALLBACK_DESTINATIONS).toContain(destination);
  });

  test('avoids repeating the same destination twice in a row', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'устремляется за новой эмоцией' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'устремляется за новой эмоцией' } }],
        }),
      });
    global.fetch = fetchMock;
    Math.random = jest.fn(() => 0);

    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];

    await messageHandler('channel', { username: 'user' }, '!куда Катя', false);
    await messageHandler('channel', { username: 'user' }, '!куда Катя', false);

    const actionId = getChatActionId('whereToResult');
    const calls = streamerBotMock.triggerAction.mock.calls.filter(
      ([id]) => id === actionId
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][1].message).toBe('Катя устремляется за новой эмоцией');
    expect(calls[1][1].message).toBe('Катя за острым раменом');
  });
});

describe('!кто', () => {
  let originalRandom;

  beforeEach(() => {
    originalRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  test('copies subject and appends random chatter username', async () => {
    Math.random = jest.fn(() => 0.1);
    const supabase = createSupabaseMessage([], undefined, {
      whereChatters: [
        { users: { username: 'Глеб', twitch_login: 'gleb' } },
        { users: { username: 'Марина', twitch_login: 'marina' } },
      ],
    });

    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!кто лучший модератор',
      tags: { username: 'user' },
    });

    expectChatAction(streamerBotMock, 'whoResult', {
      message: 'лучший модератор @Глеб',
      initiator: 'user',
      type: 'who',
    });
  });

  test('falls back to initiator when chatters list is empty', async () => {
    Math.random = jest.fn(() => 0.95);
    const supabase = createSupabaseMessage([], undefined, {
      whereChatters: [],
    });

    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!кто',
      tags: { username: 'user' },
    });

    expectChatAction(streamerBotMock, 'whoResult', {
      message: '@user',
      initiator: 'user',
      type: 'who',
    });
  });

  test('uses twitch login when display name missing', async () => {
    Math.random = jest.fn(() => 0.4);
    const supabase = createSupabaseMessage([], undefined, {
      whereChatters: [
        { users: { username: null, twitch_login: 'loginuser' } },
      ],
    });

    const { streamerBotMock } = await dispatchMessage({
      supabase,
      message: '!кто',
      tags: { username: 'user' },
    });

    expectChatAction(streamerBotMock, 'whoResult', {
      message: '@loginuser',
      initiator: 'user',
      type: 'who',
    });
  });
});

describe('message handler vote results', () => {
  test('accepts numeric selection for poll vote', async () => {
    const on = jest.fn();
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = createSupabaseMessage([], insert, {
      pollGames: [
        { id: 10, name: 'Doom' },
        { id: 11, name: 'Quake' },
      ],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game 2', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollVoteSuccess', {
      message: '@user, голос за "Quake" засчитан!',
      initiator: 'user',
      type: 'success',
    });
    expect(insert).toHaveBeenCalledWith({
      poll_id: 5,
      game_id: 11,
      user_id: 1,
      slot: 1,
    });
  });

  test('rejects out of range numeric selection', async () => {
    const on = jest.fn();
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = createSupabaseMessage([], insert, {
      pollGames: [{ id: 10, name: 'Doom' }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game 3', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollGameNotFound', {
      message: '@user, неверный номер игры.',
      initiator: 'user',
      type: 'info',
    });
    expect(insert).not.toHaveBeenCalled();
  });

  test('notifies when vote limit reached', async () => {
    const on = jest.fn();
    const supabase = createSupabaseMessage([{ slot: 1 }]);
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game Doom', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollVoteLimit', {
      message: '@user, лимит голосов исчерпан.',
      initiator: 'user',
      type: 'info',
    });
  });

  test('shows technical message for unknown reason', async () => {
    const on = jest.fn();
    const insert = jest.fn(() => Promise.resolve({ error: new Error('fail') }));
    const supabase = createSupabaseMessage([], insert);
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game Doom', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollVoteTechnical', {
      message: '@user, не удалось обработать голос из-за технических проблем.',
      initiator: 'user',
      type: 'error',
    });
  });
});

describe('message handler subcommands', () => {
  test('lists games for active poll', async () => {
    const on = jest.fn();
    const supabase = createSupabaseMessage([]);
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game список', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    const pollListCall = streamerBotMock.triggerAction.mock.calls.find(
      ([id]) => id === getChatActionId('pollList')
    );
    expect(pollListCall).toBeDefined();
    const payload = pollListCall[1] || {};
    expect(payload).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('1.'),
        initiator: 'user',
        type: 'list',
      })
    );
    expect(payload.message).not.toContain('|');
  });

  test('reports remaining votes', async () => {
    const on = jest.fn();
    const supabase = createSupabaseMessage([{ game_id: 1, games: { name: 'Doom' } }]);
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollVotesStatus', {
      message: '@user, у вас осталось 0 голосов. Вы проголосовали за: Doom (1).',
      initiator: 'user',
      type: 'info',
    });
  });

  test('reports remaining votes for new user with default limit', async () => {
    const on = jest.fn();
    const supabase = createSupabaseMessage([], undefined, {
      existingUser: null,
      insertedUser: { id: 2, username: 'user' },
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollVotesStatus', {
      message: '@user, у вас осталось 1 голосов.',
      initiator: 'user',
      type: 'info',
    });
  });

  test('reports remaining votes with custom vote limit', async () => {
    const on = jest.fn();
    const supabase = createSupabaseMessage(
      [
        { game_id: 1, games: { name: 'Doom' } },
        { game_id: 1, games: { name: 'Doom' } },
        { game_id: 2, games: { name: 'Quake' } },
      ],
      undefined,
      { existingUser: { id: 1, username: 'User', vote_limit: 5 } }
    );
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const messageHandler = on.mock.calls.find((c) => c[0] === 'message')[1];
    await messageHandler('channel', { username: 'user' }, '!game голоса', false);
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'pollVotesStatus', {
      message: '@user, у вас осталось 2 голосов. Вы проголосовали за: Doom (2), Quake (1).',
      initiator: 'user',
      type: 'info',
    });
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
          return createEventLogsTable(insertMock);
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
          return createEventLogsTable(insertMock);
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
          return createEventLogsTable(insertMock);
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
          return createEventLogsTable(insertMock);
        }
        return baseFrom(table);
      }),
    };
    const on = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'musicInvalidLink', {
      message: '@user, invalid YouTube link.',
      initiator: 'user',
      type: 'error',
    });
    consoleSpy.mockRestore();
  });

  test('increments vote_limit when extra vote reward is redeemed', async () => {
    const rewardId = 'e776c465-7f7a-4a41-8593-68165248ecd8';
    const supabase = createSupabaseMessage([]);
    const on = jest.fn();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'rewardExtraVote', {
      message: '@user, вам добавлен дополнительный голос.',
      initiator: 'user',
      type: 'success',
    });
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
          return createEventLogsTable(insertMock);
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
        title: '1',
        type: 'donation',
        created_at: expect.any(String),
      })
    );
    expect(insertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: 'Donation from Bob: 5 USD',
        media_url: 'http://clip',
        preview_url: null,
        title: '2',
        type: 'donation',
        created_at: expect.any(String),
      })
    );
    expect(insertMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        message: 'Donation from Carol: 7 USD',
        media_url: 'https://youtu.be/abc123',
        preview_url: expect.stringContaining('img.youtube.com'),
        title: '3',
        type: 'donation',
        created_at: expect.any(String),
      })
    );

    global.fetch.mockRestore();
  });

  test('skips donations older than stored cursor', async () => {
    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'log_rewards') {
          return { select: jest.fn(() => Promise.resolve({ data: [], error: null })) };
        }
        if (table === 'event_logs') {
          return createEventLogsTable(
            insertMock,
            () => Promise.resolve({ data: { title: '5' }, error: null })
          );
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
                })),
              })),
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
          { id: 4, username: 'Old', amount: '1', currency: 'USD' },
          { id: 6, username: 'New', amount: '2', currency: 'USD' },
        ],
      }),
    });

    loadBot(supabase);
    await new Promise(setImmediate);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: '6', type: 'donation' })
    );

    global.fetch.mockRestore();
  });

  test.each([
    [
      'Supabase error',
      () => Promise.resolve({ data: null, error: new Error('boom') }),
    ],
    [
      'missing token',
      () => Promise.resolve({ data: { access_token: null }, error: null }),
    ],
  ])('checkDonations handles %s gracefully', async (_caseName, maybeSingleImpl) => {
    const supabase = {
      from: jest.fn((table) => {
        switch (table) {
          case 'log_rewards':
            return {
              select: jest.fn(() => Promise.resolve({ data: [], error: null })),
            };
          case 'event_logs':
            return createEventLogsTable();
          case 'donationalerts_tokens':
            return {
              select: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn(maybeSingleImpl),
                  })),
                })),
              })),
            };
          default:
            return {
              select: jest.fn(() => Promise.resolve({ data: [], error: null })),
            };
        }
      }),
    };

    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const { bot } = loadBot(supabase);
    await new Promise(setImmediate);

    await expect(bot.checkDonations()).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});

describe('!интим', () => {
  test('logs event with detailed type', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim();
    loadBotWithOn(supabase, on);
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

  test('requests Together.ai for variant one and applies placeholders', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [
        { user_id: 2, users: { username: 'target' } },
        { user_id: 3, users: { username: 'buddy' } },
        { user_id: 4, users: { username: 'extra' } },
      ],
    });
    const originalFetch = global.fetch;
    const fetchMock = jest.fn((url) => {
      if (url === 'https://api.together.xyz/v1/chat/completions') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    'по пьяни с $intimuser и $randomnumber2:10 свечами',
                },
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });

    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];

    global.fetch = fetchMock;
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    try {
      await handler(
        'channel',
        { username: 'author', 'display-name': 'Author' },
        '!интим космический плед',
        false
      );
    } finally {
      randomSpy.mockRestore();
      global.fetch = originalFetch;
    }

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const [, options] = togetherCall;
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-together-key');
    const body = JSON.parse(options.body);
    expect(body.messages[0].content).toContain('команды !интим');
    expect(body.messages[1].content).toContain(
      'переменные [от (минимальное число) до (максимальное число)]'
    );
    expect(body.messages[1].content).toContain(
      'Учитывай дополнительный пользовательский текст (может отсутствовать).'
    );
    expect(body.messages[1].content).toContain(
      'Текст: "космический плед". Постарайся обыграть его'
    );
    expect(body.messages[1].content).toContain(
      'Объект события: случайный зритель.'
    );
    expect(body.messages[1].content).toContain(
      'Этот объект должен оставаться центром сцены; не смещай фокус на посторонних.'
    );
    expect(body.messages[1].content).toContain(
      'главный участник интимной сцены — выбранный ботом партнёр, третьи лица остаются фоном'
    );
    expect(body.messages[1].content).toContain(
      'Ник @target уже упоминается отдельно, не произноси его напрямую.'
    );

    expectChatAction(streamerBotMock, 'intimResult', {
      message:
        '0% шанс того, что у @author по пьяни с @buddy и 2 свечами будет интим с @target',
      initiator: 'author',
      target: 'target',
    });
  });

  test('sends Streamer.bot payload when configured', async () => {
    const originalFetch = global.fetch;
    process.env.STREAMERBOT_INTIM_ACTION = 'Интим Overlay';
    process.env.STREAMERBOT_API_URL = 'http://localhost:7478';

    try {
      const on = jest.fn();
      const supabase = createSupabaseIntim();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
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

      expect(streamerBotMock.triggerIntim).toHaveBeenCalled();
      const [payload] = streamerBotMock.triggerIntim.mock.calls[0];
      expect(payload).toEqual(
        expect.objectContaining({
          type: 'intim_no_tag_0',
          initiator: 'author',
          target: 'target',
          message: '0% шанс того, что у @author в кустах будет интим с @target',
        })
      );
    } finally {
      delete process.env.STREAMERBOT_INTIM_ACTION;
      delete process.env.STREAMERBOT_API_URL;
    }
  });

  test('sends обычные type when no stats recorded', async () => {
    process.env.STREAMERBOT_INTIM_ACTION = 'Интим Overlay';

    try {
      const on = jest.fn();
      const supabase = createSupabaseIntim();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
      const triggerSpy = jest.spyOn(streamerBotMock.client, 'triggerAction');
      await new Promise(setImmediate);
      const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
      jest.spyOn(Math, 'random').mockReturnValue(0.42);
      await handler(
        'channel',
        { username: 'author', 'display-name': 'Author' },
        '!интим',
        false
      );
      Math.random.mockRestore();

      const actionCall = triggerSpy.mock.calls.find(
        ([actionId]) => actionId === 'Интим Overlay'
      );
      expect(actionCall).toBeDefined();
      const [, payload] = actionCall;
      expect(payload).toEqual(
        expect.objectContaining({
          type: 'обычные',
          initiator: 'author',
          target: 'target',
          message: '42% шанс того, что у @author в кустах будет интим с @target',
        })
      );
      triggerSpy.mockRestore();
    } finally {
      delete process.env.STREAMERBOT_INTIM_ACTION;
    }
  });

  test('sends Streamer.bot action id when GUID provided', async () => {
    process.env.STREAMERBOT_INTIM_ACTION =
      '9fca0b82-1ce4-4d7b-92d4-b6c2a8b41be3';

    try {
      const on = jest.fn();
      const supabase = createSupabaseIntim();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
      const triggerSpy = jest.spyOn(streamerBotMock.client, 'triggerAction');
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

      const actionCall = triggerSpy.mock.calls.find(
        ([actionId]) => actionId === '9fca0b82-1ce4-4d7b-92d4-b6c2a8b41be3'
      );
      expect(actionCall).toBeDefined();
      const [, payload] = actionCall;
      expect(payload).toEqual(
        expect.objectContaining({
          type: 'intim_no_tag_0',
          initiator: 'author',
          target: 'target',
          message: '0% шанс того, что у @author в кустах будет интим с @target',
        })
      );
      triggerSpy.mockRestore();
    } finally {
      delete process.env.STREAMERBOT_INTIM_ACTION;
    }
  });

  test('triggers default and typed actions when type GUID configured', async () => {
    const defaultAction = '11111111-2222-3333-4444-555555555555';
    const typeAction = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    process.env.STREAMERBOT_INTIM_ACTION = defaultAction;
    process.env.SB_INTIM_NO_TAG_0 = typeAction;

    try {
      const on = jest.fn();
      const supabase = createSupabaseIntim();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
      const triggerSpy = jest.spyOn(streamerBotMock.client, 'triggerAction');
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

      const relevantCalls = triggerSpy.mock.calls.filter(([actionId]) =>
        [defaultAction, typeAction].includes(actionId)
      );
      expect(relevantCalls).toHaveLength(2);
      expect(relevantCalls[0][0]).toBe(defaultAction);
      expect(relevantCalls[1][0]).toBe(typeAction);
      const [defaultPayload] = relevantCalls[0].slice(1);
      const [typedPayload] = relevantCalls[1].slice(1);
      expect(defaultPayload).toEqual(
        expect.objectContaining({
          type: 'intim_no_tag_0',
          initiator: 'author',
          target: 'target',
        })
      );
      expect(typedPayload).toEqual(
        expect.objectContaining({
          type: 'intim_no_tag_0',
          initiator: 'author',
          target: 'target',
        })
      );
      triggerSpy.mockRestore();
    } finally {
      delete process.env.STREAMERBOT_INTIM_ACTION;
      delete process.env.SB_INTIM_NO_TAG_0;
    }
  });
  test('does not log event without main column', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler('channel', { username: 'author', 'display-name': 'Author' }, '!интим', false);
    randomSpy.mockRestore();
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expect(supabase.eventLogsInsert).not.toHaveBeenCalled();
  });
  test('без тега выводит шанс для автора', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      on,
      message: '!интим',
      tags: { username: 'author', 'display-name': 'Author' },
    });
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'intimResult', {
      message: '50% шанс того, что у @author в кустах будет интим с @target',
      initiator: 'author',
      target: 'target',
      type: 'обычные',
    });
    randomSpy.mockRestore();
  });

  test('с тегом выводит шанс для пары с случайным партнером', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
    });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      on,
      message: '!интим @target',
      tags: { username: 'author', 'display-name': 'Author' },
    });
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'intimResult', {
      message:
        '50% шанс того, что @author тайно @target интимиться с @partner в кустах',
      initiator: 'author',
      target: 'partner',
      type: 'обычные',
    });
    randomSpy.mockRestore();
  });

  test('при выборе автора без тега сообщение корректно', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { streamerBotMock } = await dispatchMessage({
      supabase,
      on,
      message: '!интим',
      tags: { username: 'author', 'display-name': 'Author' },
    });
    expect(streamerBotMock.triggerAction).toHaveBeenCalledTimes(1);
    expectChatAction(streamerBotMock, 'intimResult', {
      message: '50% шанс того, что у @author в кустах будет интим с @author',
      initiator: 'author',
      target: 'author',
      type: 'intim_self_no_tag',
    });
    randomSpy.mockRestore();
  });

  test('при выборе автора с тегом сообщение корректно', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!интим @target',
      false
    );
    expectChatAction(streamerBotMock, 'intimResult', {
      message: '50% шанс того, что @author тайно @target интимиться с @author в кустах',
      initiator: 'author',
      target: 'author',
      type: 'intim_self_with_tag',
    });
    Math.random.mockRestore();
  });

  test('increments intim_self_no_tag when author chosen without tag', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'intimResult', {
      type: 'intim_self_no_tag',
      initiator: 'author',
    });
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'intim_self_no_tag')
      )
    ).toBe(true);
  });

  test('increments intim_self_with_tag when author tags someone', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'intimResult', {
      type: 'intim_self_with_tag',
      initiator: 'author',
    });
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'intim_self_with_tag')
      )
    ).toBe(true);
  });

  test('increments counters for tag match on both users', async () => {
    const on = jest.fn();
    const supabase = createSupabaseIntim({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'intimResult', {
      initiator: 'author',
      type: 'intim_with_tag_69',
    });

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
    const supabase = createSupabasePoceluy();
    loadBotWithOn(supabase, on);
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

  test('requests Together.ai for variant two and applies placeholders', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [
        { user_id: 2, users: { username: 'partner' } },
        { user_id: 3, users: { username: 'buddy' } },
        { user_id: 4, users: { username: 'extra' } },
      ],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];

    const originalFetch = global.fetch;
    const togetherResponses = [
      {
        choices: [
          {
            message: {
              content: [
                {
                  type: 'text',
                  text:
                    'после $randomnumber2:5 глотков посмеётся с [random_chatter] и',
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: [
                {
                  type: 'text',
                  text: 'страстно',
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: [
                {
                  type: 'text',
                  text: 'нежно',
                },
              ],
            },
          },
        ],
      },
    ];
    const fetchMock = jest.fn((url) => {
      if (url === 'https://api.together.xyz/v1/chat/completions') {
        const payload = togetherResponses.shift() || { choices: [] };
        return Promise.resolve({
          ok: true,
          json: async () => payload,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });

    global.fetch = fetchMock;
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    try {
      await handler(
        'channel',
        { username: 'author', 'display-name': 'Author' },
        '!поцелуй @target яркий танец',
        false
      );
    } finally {
      randomSpy.mockRestore();
      global.fetch = originalFetch;
    }

    const togetherCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://api.together.xyz/v1/chat/completions'
    );
    expect(togetherCall).toBeDefined();
    const [, options] = togetherCall;
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-together-key');
    const body = JSON.parse(options.body);
    expect(body.messages[0].content).toContain('команды !поцелуй');
    expect(body.messages[1].content).toContain('$randomnumber2:5');
    expect(body.messages[1].content).toContain('@buddy');
    expect(body.messages[1].content).toContain(
      'Учитывай дополнительный пользовательский текст (может отсутствовать).'
    );
    expect(body.messages[1].content).toContain(
      'Текст: "яркий танец". Постарайся обыграть его'
    );
    expect(body.messages[1].content).toContain(
      'Объект события: зритель, которого автор отметил через тег.'
    );
    expect(body.messages[1].content).toContain(
      'Ник @target уже упоминается отдельно, не произноси его напрямую.'
    );

    expectChatAction(streamerBotMock, 'poceluyResult', {
      message:
        '0% шанс того, что @author после 2 глотков посмеётся с @buddy и @target поцелует нежно @partner страстно',
      initiator: 'author',
      target: 'partner',
    });
  });

  test('sends Streamer.bot payload when configured', async () => {
    process.env.STREAMERBOT_POCELUY_ACTION = 'Поцелуй Overlay';
    process.env.STREAMERBOT_API_URL = 'http://localhost:7478';

    try {
      const on = jest.fn();
      const supabase = createSupabasePoceluy();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
      const triggerSpy = jest.spyOn(streamerBotMock.client, 'triggerAction');
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

      const actionCall = triggerSpy.mock.calls.find(
        ([actionId]) => actionId === 'Поцелуй Overlay'
      );
      expect(actionCall).toBeDefined();
      const [, payload] = actionCall;
      expect(payload).toEqual(
        expect.objectContaining({
          type: 'poceluy_no_tag_0',
          initiator: 'author',
          target: 'target',
          message: '0% шанс того, что у @author страстно поцелует @target',
        })
      );
      triggerSpy.mockRestore();
    } finally {
      delete process.env.STREAMERBOT_POCELUY_ACTION;
      delete process.env.STREAMERBOT_API_URL;
    }
  });

  test('sends обычные type when no stats recorded', async () => {
    process.env.STREAMERBOT_POCELUY_ACTION = 'Поцелуй Overlay';

    try {
      const on = jest.fn();
      const supabase = createSupabasePoceluy();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
      await new Promise(setImmediate);
      const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
      jest.spyOn(Math, 'random').mockReturnValue(0.42);
      await handler(
        'channel',
        { username: 'author', 'display-name': 'Author' },
        '!поцелуй',
        false
      );
      Math.random.mockRestore();

      expectChatAction(streamerBotMock, 'poceluyResult', {
        type: 'обычные',
        initiator: 'author',
        target: 'target',
        message: '42% шанс того, что у @author страстно поцелует @target',
      });
    } finally {
      delete process.env.STREAMERBOT_POCELUY_ACTION;
    }
  });

  test('triggers default and typed actions when type GUID configured', async () => {
    const defaultAction = '55555555-4444-3333-2222-111111111111';
    const typeAction = 'eeeeeeee-dddd-cccc-bbbb-aaaaaaaaaaaa';
    process.env.STREAMERBOT_POCELUY_ACTION = defaultAction;
    process.env.SB_POCELUY_NO_TAG_0 = typeAction;

    try {
      const on = jest.fn();
      const supabase = createSupabasePoceluy();
      const { streamerBotMock } = loadBotWithOn(supabase, on);
      const triggerSpy = jest.spyOn(streamerBotMock.client, 'triggerAction');
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

      const relevantCalls = triggerSpy.mock.calls.filter(([actionId]) =>
        [defaultAction, typeAction].includes(actionId)
      );
      expect(relevantCalls).toHaveLength(2);
      expect(relevantCalls[0][0]).toBe(defaultAction);
      expect(relevantCalls[1][0]).toBe(typeAction);
      const [defaultPayload] = relevantCalls[0].slice(1);
      const [typedPayload] = relevantCalls[1].slice(1);
      expect(defaultPayload).toEqual(
        expect.objectContaining({
          type: 'poceluy_no_tag_0',
          initiator: 'author',
          target: 'target',
        })
      );
      expect(typedPayload).toEqual(
        expect.objectContaining({
          type: 'poceluy_no_tag_0',
          initiator: 'author',
          target: 'target',
        })
      );
      triggerSpy.mockRestore();
    } finally {
      delete process.env.STREAMERBOT_POCELUY_ACTION;
      delete process.env.SB_POCELUY_NO_TAG_0;
    }
  });
  test('does not log event without main column', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expect(supabase.eventLogsInsert).not.toHaveBeenCalled();
    expect(streamerBotMock.triggerAction).toHaveBeenCalled();
  });
  test('без тега выводит шанс для автора', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler('channel', { username: 'author', 'display-name': 'Author' }, '!поцелуй', false);
    expectChatAction(streamerBotMock, 'poceluyResult', {
      message: '50% шанс того, что у @author страстно поцелует @target',
      initiator: 'author',
      target: 'target',
      type: 'обычные',
    });
    Math.random.mockRestore();
  });

  test('с тегом выводит шанс для пары с случайным партнером', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @target',
      false
    );
    expectChatAction(streamerBotMock, 'poceluyResult', {
      message:
        '50% шанс того, что @author осмелится @target поцелует @partner страстно',
      initiator: 'author',
      target: 'partner',
      type: 'обычные',
    });
    Math.random.mockRestore();
  });

  test('при выборе автора без тега сообщение корректно', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй',
      false
    );
    expectChatAction(streamerBotMock, 'poceluyResult', {
      message: '50% шанс того, что у @author страстно поцелует @author',
      initiator: 'author',
      target: 'author',
      type: 'poceluy_self_no_tag',
    });
    Math.random.mockRestore();
  });

  test('при выборе автора с тегом сообщение корректно', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await handler(
      'channel',
      { username: 'author', 'display-name': 'Author' },
      '!поцелуй @target',
      false
    );
    expectChatAction(streamerBotMock, 'poceluyResult', {
      message:
        '50% шанс того, что @author осмелится @target поцелует @author страстно',
      initiator: 'author',
      target: 'author',
      type: 'poceluy_self_with_tag',
    });
    Math.random.mockRestore();
  });

  test('increments poceluy_self_no_tag when author chosen without tag', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'poceluyResult', {
      initiator: 'author',
      type: 'poceluy_self_no_tag',
    });
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'poceluy_self_no_tag')
      )
    ).toBe(true);
  });

  test('increments poceluy_self_with_tag when author tags someone', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 1, users: { username: 'author' } }],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'poceluyResult', {
      initiator: 'author',
      type: 'poceluy_self_with_tag',
    });
    expect(
      supabase.usersTable.update.mock.calls.some((c) =>
        Object.prototype.hasOwnProperty.call(c[0], 'poceluy_self_with_tag')
      )
    ).toBe(true);
  });

  test('increments counters for tag match on both users', async () => {
    const on = jest.fn();
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'poceluyResult', {
      initiator: 'author',
      type: 'poceluy_with_tag_69',
    });

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
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'poceluyResult', {
      initiator: 'author',
      type: 'poceluy_with_tag_0',
    });

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
    const supabase = createSupabasePoceluy({
      chatters: [{ user_id: 2, users: { username: 'partner' } }],
      users: [
        { id: 1, username: 'author', twitch_login: 'author', vote_limit: 1 },
        { id: 2, username: 'partner', twitch_login: 'partner' },
      ],
    });
    const { streamerBotMock } = loadBotWithOn(supabase, on);
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
    expectChatAction(streamerBotMock, 'poceluyResult', {
      initiator: 'author',
      type: 'poceluy_with_tag_100',
    });

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
    const supabase = createSupabaseIntim();
    const { streamerBotMock } = loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'clip1' }] }) });

    await handler('channel', { username: 'author', 'display-name': 'Author' }, '!clip', false);

    expectChatAction(streamerBotMock, 'clipSuccess', {
      message: '@author, клип создан: https://clips.twitch.tv/clip1',
      initiator: 'author',
      type: 'success',
    });

    expect(
      supabase.usersTable.update.records.some(
        (r) => r.id === 1 && r.data.clips_created === 1
      )
    ).toBe(true);

    fetchMock.mockRestore();
  });
});

describe('first message achievement', () => {
  test('awards only once per stream', async () => {
    const on = jest.fn();
    const supabase = createSupabaseFirstMessage();
    loadBotWithOn(supabase, on);
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

describe('stream chatters updates', () => {
  test('skips chatter tracking when stream is offline', async () => {
    const on = jest.fn();
    const supabase = createSupabaseFirstMessage();
    const originalFrom = supabase.from;
    loadBotWithOn(supabase, on);
    await new Promise(setImmediate);
    const handler = on.mock.calls.find((c) => c[0] === 'message')[1];

    await handler(
      'channel',
      { username: 'viewer', 'display-name': 'Viewer' },
      'hello there',
      false
    );

    const chatterCalls = originalFrom.mock.calls.filter(
      ([table]) => table === 'stream_chatters'
    );
    expect(chatterCalls).toHaveLength(0);
  });

  test('clears stream chatters when stream goes offline without twitch secret', async () => {
    const originalFetch = global.fetch;
    const originalSecretEnv = process.env.TWITCH_SECRET;
    const originalSetInterval = global.setInterval;
    jest.resetModules();

    const streamChattersDeleteNeq = jest.fn(() => Promise.resolve({ error: null }));
    const streamChattersDelete = jest.fn(() => ({ neq: streamChattersDeleteNeq }));
    const streamChattersSelect = jest.fn(() => Promise.resolve({ data: [], error: null }));

    const mockSupabase = {
      from: jest.fn((table) => {
        switch (table) {
          case 'twitch_tokens':
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
          case 'stream_chatters':
            return {
              delete: streamChattersDelete,
              select: streamChattersSelect,
              upsert: jest.fn(() => Promise.resolve({ error: null })),
            };
          case 'donationalerts_tokens':
            return {
              select: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn(() =>
                      Promise.resolve({
                        data: {
                          access_token: 'alerts',
                          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                        },
                        error: null,
                      })
                    ),
                  })),
                })),
              })),
            };
          case 'log_rewards':
            return {
              select: jest.fn(() => Promise.resolve({ data: [], error: null })),
            };
          case 'event_logs':
            return createEventLogsTable();
          default:
            return {
              select: jest.fn(() => Promise.resolve({ data: [], error: null })),
              insert: jest.fn(() => Promise.resolve({ error: null })),
              update: jest.fn(() => Promise.resolve({ error: null })),
            };
        }
      }),
    };

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

    const streamResponses = [
      { data: [{ id: 'online' }] },
      { data: [] },
    ];

    const fetchMock = jest.fn((input, options = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('helix/streams')) {
        const body = streamResponses.shift() || { data: [] };
        return Promise.resolve({
          ok: true,
          json: async () => body,
        });
      }
      if (url.includes('donationalerts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    global.fetch = fetchMock;
    const intervals = [];
    global.setInterval = jest.fn((fn, ms, ...args) => {
      intervals.push({ fn, ms, args });
      return intervals.length;
    });

    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_KEY = 'key';
    process.env.BOT_USERNAME = 'bot';
    process.env.TWITCH_CHANNEL = 'channel';
    process.env.TWITCH_CLIENT_ID = 'cid';
    process.env.TWITCH_CHANNEL_ID = '123';
    process.env.MUSIC_REWARD_ID = '545cc880-f6c1-4302-8731-29075a8a1f17';
    process.env.BOT_SCHEDULE_INTERVALS = 'true';
    delete process.env.TWITCH_SECRET;

    try {
      require('../bot');

      await Promise.resolve();
      await new Promise(setImmediate);

      expect(streamChattersDelete).toHaveBeenCalledTimes(1);
      expect(streamChattersDeleteNeq).toHaveBeenCalledWith('user_id', 0);

      const streamStatusInterval = intervals.find(({ fn }) => fn?.name === 'checkStreamStatus');
      expect(streamStatusInterval).toBeDefined();

      await streamStatusInterval.fn();

      await Promise.resolve();
      await new Promise(setImmediate);

      expect(streamChattersDelete).toHaveBeenCalledTimes(2);
      expect(streamChattersDeleteNeq).toHaveBeenCalledWith('user_id', 0);

      const helixCalls = fetchMock.mock.calls.filter(([url]) =>
        typeof url === 'string' && url.includes('helix/streams')
      );
      expect(helixCalls).toHaveLength(2);
      helixCalls.forEach(([_, opts = {}]) => {
        expect(opts?.headers?.Authorization).toBe('Bearer streamer');
      });
    } finally {
      global.setInterval = originalSetInterval;
      delete process.env.BOT_SCHEDULE_INTERVALS;
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        delete global.fetch;
      }
      if (originalSecretEnv === undefined) {
        delete process.env.TWITCH_SECRET;
      } else {
        process.env.TWITCH_SECRET = originalSecretEnv;
      }
    }
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
    const { bot } = loadBot(supabase);
    const { applyRandomPlaceholders } = bot;

    const context = '[random_chatter] появится через [от 3 до 10] минут';
    const result = await applyRandomPlaceholders(context);
    const match = result.match(/^@target появится через (\d+) минут$/);
    expect(match).not.toBeNull();
    const num = parseInt(match[1], 10);
    expect(num).toBeGreaterThanOrEqual(3);
    expect(num).toBeLessThanOrEqual(10);
  });
});
