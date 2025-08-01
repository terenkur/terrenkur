const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const votes = [
  { game_id: 1, user_id: 1 },
  { game_id: 1, user_id: 2 },
  { game_id: 2, user_id: 1 },
];
const games = [
  { id: 1, name: 'Game1' },
  { id: 2, name: 'Game2' },
];
const pollGames = [{ game_id: 1 }, { game_id: 1 }, { game_id: 2 }];
const users = [
  { id: 1, username: 'Alice' },
  { id: 2, username: 'Bob' },
];

const build = (data) => {
  const builder = {};
  const chain = ['select', 'eq', 'order', 'limit', 'in', 'insert', 'update', 'upsert', 'delete'];
  chain.forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.maybeSingle = jest.fn(async () => ({ data: builder.data ?? data, error: null }));
  builder.single = jest.fn(async () => ({ data: builder.data ?? data, error: null }));
  builder.then = (resolve) => Promise.resolve({ data: builder.data ?? data, error: null }).then(resolve);
  return builder;
};

const buildGames = (all) => {
  const builder = build(all);
  builder.data = all;
  builder.in = jest.fn((_col, ids) => {
    builder.data = all.filter((g) => ids.includes(g.id));
    return builder;
  });
  return builder;
};

const buildUsers = (all) => {
  const builder = build(all);
  builder.data = all;
  builder.in = jest.fn((_col, ids) => {
    builder.data = all.filter((u) => ids.includes(u.id));
    return builder;
  });
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    switch (table) {
      case 'votes':
        return build(votes);
      case 'poll_games':
        return build(pollGames);
      case 'games':
        return buildGames(games);
      case 'users':
        return buildUsers(users);
      default:
        return build(null);
    }
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('stats endpoints', () => {
  it('returns aggregated game votes', async () => {
    const res = await request(app).get('/api/stats/popular-games');
    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([
      { id: 1, name: 'Game1', votes: 2 },
      { id: 2, name: 'Game2', votes: 1 },
    ]);
  });

  it('returns aggregated user votes', async () => {
    const res = await request(app).get('/api/stats/top-voters');
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([
      { id: 1, username: 'Alice', votes: 2 },
      { id: 2, username: 'Bob', votes: 1 },
    ]);
  });

  it('returns roulette counts per game', async () => {
    const res = await request(app).get('/api/stats/game-roulettes');
    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([
      { id: 1, name: 'Game1', roulettes: 2 },
      { id: 2, name: 'Game2', roulettes: 1 },
    ]);
  });
});
