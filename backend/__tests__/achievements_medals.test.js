const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const achievementsTable = [
  {
    id: 1,
    stat_key: 'first_message',
    title: 'First Blood',
    description: 'Отправлено первое сообщение в чате',
    threshold: 1,
  },
  {
    id: 2,
    stat_key: 'clips_created',
    title: 'Клипмейкер',
    description: 'Создан первый клип',
    threshold: 1,
  },
  {
    id: 3,
    stat_key: 'combo_commands',
    title: 'Комбо-режим',
    description: 'Выполнить !интим и !поцелуй в течение 60 секунд',
    threshold: 1,
  },
];

const userAchievements = [
  { user_id: 1, achievement_id: 1, earned_at: '2024-01-01T00:00:00Z' },
  { user_id: 1, achievement_id: 2, earned_at: '2024-02-01T00:00:00Z' },
  { user_id: 1, achievement_id: 3, earned_at: '2024-03-01T00:00:00Z' },
];

const votes = [
  { game_id: 1, user_id: 1, poll_id: 1 },
  { game_id: 1, user_id: 2, poll_id: 1 },
  { game_id: 2, user_id: 1, poll_id: 2 },
  { game_id: 3, user_id: 4, poll_id: 3 },
  { game_id: 4, user_id: 4, poll_id: 4 },
  { game_id: 5, user_id: 4, poll_id: 5 },
];

const users = [
  {
    id: 1,
    username: 'Alice',
    total_streams_watched: 50,
    total_subs_gifted: 5,
    intim_no_tag_0: 2,
    clips_created: 0,
    combo_commands: 0,
  },
  {
    id: 2,
    username: 'Bob',
    total_streams_watched: 40,
    total_subs_gifted: 1,
    intim_no_tag_0: 5,
    clips_created: 0,
    combo_commands: 0,
  },
  {
    id: 3,
    username: 'Carol',
    total_streams_watched: 30,
    total_subs_gifted: 3,
    intim_no_tag_0: 10,
    clips_created: 0,
    combo_commands: 0,
  },
  {
    id: 4,
    username: 'terrenkur',
    total_streams_watched: 100,
    total_subs_gifted: 10,
    intim_no_tag_0: 0,
    clips_created: 0,
    combo_commands: 0,
  },
];

const build = (all) => {
  const builder = {};
  const chain = ['select', 'eq', 'order', 'limit', 'in', 'insert', 'update', 'upsert', 'delete'];
  chain.forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.data = all;
  builder.maybeSingle = jest.fn(async () => ({ data: builder.data ?? all, error: null }));
  builder.single = jest.fn(async () => ({ data: builder.data ?? all, error: null }));
  builder.then = (resolve) => Promise.resolve({ data: builder.data ?? all, error: null }).then(resolve);
  return builder;
};

const buildUsers = (all) => {
  const builder = build(all);
  builder.in = jest.fn((_col, ids) => {
    builder.data = all.filter((u) => ids.includes(u.id));
    return builder;
  });
  return builder;
};

const buildUserAchievements = (all) => {
  const builder = build(all);
  builder.eq = jest.fn((col, value) => {
    builder.data = all.filter((u) => u[col] === value);
    return builder;
  });
  return builder;
};

const buildAchievements = (all) => {
  const builder = build(all);
  builder.in = jest.fn((_col, ids) => {
    builder.data = all.filter((a) => ids.includes(a.id));
    return builder;
  });
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    switch (table) {
      case 'users':
        return buildUsers(users);
      case 'votes':
        return build(votes);
      case 'user_achievements':
        return buildUserAchievements(userAchievements);
      case 'achievements':
        return buildAchievements(achievementsTable);
      default:
        return build([]);
    }
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('achievements endpoint', () => {
  it('returns user achievements', async () => {
    const res = await request(app).get('/api/achievements/1');
    expect(res.status).toBe(200);
    expect(res.body.achievements).toEqual([
      {
        id: 1,
        stat_key: 'first_message',
        title: 'First Blood',
        description: 'Отправлено первое сообщение в чате',
        threshold: 1,
        earned_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        stat_key: 'clips_created',
        title: 'Клипмейкер',
        description: 'Создан первый клип',
        threshold: 1,
        earned_at: '2024-02-01T00:00:00Z',
      },
      {
        id: 3,
        stat_key: 'combo_commands',
        title: 'Комбо-режим',
        description: 'Выполнить !интим и !поцелуй в течение 60 секунд',
        threshold: 1,
        earned_at: '2024-03-01T00:00:00Z',
      },
    ]);
  });
});

describe('medals endpoint', () => {
  it('returns medals for user', async () => {
    const res = await request(app).get('/api/medals/1');
    expect(res.status).toBe(200);
    expect(res.body.medals.total_streams_watched).toBe('gold');
    expect(res.body.medals.total_subs_gifted).toBe('gold');
    expect(res.body.medals.intim_no_tag_0).toBe('bronze');
    expect(res.body.medals.top_voters).toBe('gold');
    expect(res.body.medals.top_roulette_users).toBe('gold');
  });

  it('does not return medals for excluded users', async () => {
    const res = await request(app).get('/api/medals/4');
    expect(res.status).toBe(200);
    expect(res.body.medals.total_streams_watched).toBeNull();
    expect(res.body.medals.total_subs_gifted).toBeNull();
    expect(res.body.medals.top_voters).toBeNull();
    expect(res.body.medals.top_roulette_users).toBeNull();
  });
});

