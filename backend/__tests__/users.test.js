const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const users = [
  {
    id: 1,
    username: 'Alice',
    auth_id: null,
    twitch_login: null,
    total_streams_watched: 0,
    total_subs_gifted: 0,
    total_subs_received: 0,
    total_chat_messages_sent: 0,
    total_times_tagged: 0,
    total_commands_run: 0,
    total_months_subbed: 0,
  },
  {
    id: 2,
    username: 'Bob',
    auth_id: 'x',
    twitch_login: 'bob',
    total_streams_watched: 0,
    total_subs_gifted: 0,
    total_subs_received: 0,
    total_chat_messages_sent: 0,
    total_times_tagged: 0,
    total_commands_run: 0,
    total_months_subbed: 0,
  },
  {
    id: 3,
    username: 'Charlie',
    auth_id: null,
    twitch_login: null,
    total_streams_watched: 0,
    total_subs_gifted: 0,
    total_subs_received: 0,
    total_chat_messages_sent: 0,
    total_times_tagged: 0,
    total_commands_run: 0,
    total_months_subbed: 0,
  },
];

const votes = [
  { user_id: 1, poll_id: 1, game_id: 10 },
  { user_id: 1, poll_id: 1, game_id: 11 },
  { user_id: 1, poll_id: 2, game_id: 12 },
];

const polls = [
  { id: 1, created_at: '2023-01-01', archived: false },
  { id: 2, created_at: '2023-01-02', archived: false },
];

const pollResults = [
  { poll_id: 1, winner_id: 10 },
  { poll_id: 2, winner_id: 12 },
];

const games = [
  { id: 10, name: 'Game A' },
  { id: 11, name: 'Game B' },
  { id: 12, name: 'Game C' },
];

const buildTable = (all) => {
  let data = all;
  const builder = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((col, val) => {
    data = data.filter((r) => r[col] === val);
    return builder;
  });
  builder.in = jest.fn((col, arr) => {
    data = data.filter((r) => arr.includes(r[col]));
    return builder;
  });
  builder.maybeSingle = jest.fn(() =>
    Promise.resolve({ data: data[0] || null, error: null })
  );
  builder.then = (resolve) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return builder;
};

const buildUsers = (all) => {
  let data = all;
  const builder = {};
  builder.select = jest.fn(() => {
    data = all;
    return builder;
  });
  builder.order = jest.fn(() => builder);
  builder.ilike = jest.fn((_col, pattern) => {
    const s = pattern.replace(/%/g, '').toLowerCase();
    data = all.filter((u) => u.username.toLowerCase().includes(s));
    return builder;
  });
  builder.eq = jest.fn((col, val) => {
    data = all.filter((u) => u[col] === val);
    return builder;
  });
  builder.maybeSingle = jest.fn(() =>
    Promise.resolve({ data: data[0] || null, error: null })
  );
  builder.then = (resolve) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    if (table === 'users') return buildUsers(users);
    if (table === 'votes') return buildTable(votes);
    if (table === 'polls') return buildTable(polls);
    if (table === 'poll_results') return buildTable(pollResults);
    if (table === 'games') return buildTable(games);
    return buildTable([]);
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('GET /api/users', () => {
  it('returns all users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(3);
  });

  it('filters by username', async () => {
    const res = await request(app).get('/api/users?search=ali');
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([
      {
        id: 1,
        username: 'Alice',
        auth_id: null,
        twitch_login: null,
        total_streams_watched: 0,
        total_subs_gifted: 0,
        total_subs_received: 0,
        total_chat_messages_sent: 0,
        total_times_tagged: 0,
        total_commands_run: 0,
        total_months_subbed: 0,
        logged_in: false,
      },
    ]);
  });
});

describe('GET /api/users/:id', () => {
  it('includes vote and roulette counts', async () => {
    const res = await request(app).get('/api/users/1');
    expect(res.status).toBe(200);
    expect(res.body.user.votes).toBe(3);
    expect(res.body.user.roulettes).toBe(2);
  });
});
