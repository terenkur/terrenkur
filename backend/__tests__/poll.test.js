const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const poll = { id: 1, created_at: '2024-01-01', archived: false };
const pollGames = [{ game_id: 1 }, { game_id: 2 }];
const games = [
  { id: 1, name: 'Game1', background_image: null },
  { id: 2, name: 'Game2', background_image: null },
];
const votes = [
  { game_id: 1, user_id: 1 },
  { game_id: 1, user_id: 2 },
  { game_id: 2, user_id: 2 },
];
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
  builder.maybeSingle = jest.fn(async () => ({ data, error: null }));
  builder.single = jest.fn(async () => ({ data, error: null }));
  builder.then = (resolve) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    switch (table) {
      case 'polls':
        return build(poll);
      case 'poll_games':
        return build(pollGames);
      case 'games':
        return build(games);
      case 'votes':
        return build(votes);
      case 'users':
        return build(users);
      default:
        return build(null);
    }
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('GET /api/poll', () => {
  it('returns aggregated poll data', async () => {
    const res = await request(app).get('/api/poll');
    expect(res.status).toBe(200);
    expect(res.body.games.length).toBe(2);
    const game = res.body.games.find((g) => g.id === 1);
    expect(game.count).toBe(2);
    expect(game.nicknames).toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });
});
