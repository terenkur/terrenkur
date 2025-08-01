const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const poll = { id: 1, created_at: '2024-01-01', archived: false };
const pollGames = [{ game_id: 1 }, { game_id: 2 }];
const games = [
  { id: 1, name: 'Game1', background_image: null },
  { id: 2, name: 'Game2', background_image: null },
];
const baseVotes = [
  { game_id: 1, user_id: 1 },
  { game_id: 1, user_id: 1 },
  { game_id: 1, user_id: 2 },
  { game_id: 2, user_id: 2 },
];
let votes = [...baseVotes];

const baseUsers = [
  { id: 1, username: 'Alice' },
  { id: 2, username: 'Bob' },
];
let users = [...baseUsers];

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

const buildUsers = (allUsers) => {
  const builder = build(allUsers);
  builder.data = allUsers;
  builder.select = jest.fn(() => {
    // default supabase limit of 1000 rows
    builder.data = allUsers.slice(0, 1000);
    return builder;
  });
  builder.in = jest.fn((_col, ids) => {
    builder.data = allUsers.filter((u) => ids.includes(u.id));
    return builder;
  });
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

describe('GET /api/poll', () => {
  beforeEach(() => {
    votes = [...baseVotes];
    users = [...baseUsers];
  });
  it('returns aggregated poll data', async () => {
    const res = await request(app).get('/api/poll');
    expect(res.status).toBe(200);
    expect(res.body.games.length).toBe(2);
    const game = res.body.games.find((g) => g.id === 1);
    expect(game.count).toBe(3);
    expect(game.nicknames).toEqual([
      { id: 1, username: 'Alice', count: 2 },
      { id: 2, username: 'Bob', count: 1 },
    ]);
  });

  it('includes users beyond the default limit', async () => {
    users = Array.from({ length: 1001 }, (_, i) => ({
      id: i + 1,
      username: `User${i + 1}`,
    }));
    votes.push({ game_id: 1, user_id: 1001 });

    const res = await request(app).get('/api/poll');

    expect(res.status).toBe(200);
    const game = res.body.games.find((g) => g.id === 1);
    const last = game.nicknames.find((n) => n.id === 1001);
    expect(last).toEqual({ id: 1001, username: 'User1001', count: 1 });
  });
});
