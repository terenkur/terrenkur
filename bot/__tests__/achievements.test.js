test('awards multiple achievements for a single counter', async () => {
  jest.resetModules();
  jest.useFakeTimers();

  const userStats = { total_chat_messages_sent: 0 };
  const userAchievements = new Set();
  const achievementMap = { 500: 1, 1000: 2, 2000: 3 };
  const insertMock = jest.fn((obj) => {
    userAchievements.add(obj.achievement_id);
    return Promise.resolve({ error: null });
  });

  const supabase = {
    from: jest.fn((table) => {
      if (table === 'users') {
        return {
          select: jest.fn((field) => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: { [field]: userStats[field] }, error: null })
              ),
            })),
          })),
          update: jest.fn((values) => ({
            eq: jest.fn(() => {
              Object.assign(userStats, values);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }
      if (table === 'achievements') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn((_, threshold) => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({
                    data: achievementMap[threshold]
                      ? { id: achievementMap[threshold] }
                      : null,
                    error: null,
                  })
                ),
              })),
            })),
          })),
        };
      }
      if (table === 'user_achievements') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn((_, achievementId) => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({
                    data: userAchievements.has(achievementId)
                      ? { achievement_id: achievementId }
                      : null,
                    error: null,
                  })
                ),
              })),
            })),
          })),
          insert: insertMock,
        };
      }
      if (table === 'log_rewards') {
        return {
          select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
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
        select: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }),
  };

  jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => supabase) }));
  jest.doMock('tmi.js', () => ({ Client: jest.fn(() => ({ connect: jest.fn(), on: jest.fn(), opts: { identity: {} } })) }));
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }));

  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_KEY = 'key';
  process.env.BOT_USERNAME = 'bot';
  process.env.TWITCH_CHANNEL = 'channel';
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_SECRET = 'secret';
  process.env.TWITCH_CHANNEL_ID = '123';
  process.env.MUSIC_REWARD_ID = '545cc880-f6c1-4302-8731-29075a8a1f17';
  delete process.env.TWITCH_OAUTH_TOKEN;

  const { incrementUserStat } = require('../bot');
  jest.useRealTimers();

  const first = await incrementUserStat(1, 'total_chat_messages_sent', 500);
  const second = await incrementUserStat(1, 'total_chat_messages_sent', 1500);

  expect(first).toBe(true);
  expect(second).toBe(true);
  expect(insertMock).toHaveBeenCalledTimes(3);
  expect(insertMock.mock.calls[0][0].achievement_id).toBe(1);
  expect(insertMock.mock.calls[1][0].achievement_id).toBe(2);
  expect(insertMock.mock.calls[2][0].achievement_id).toBe(3);
});

