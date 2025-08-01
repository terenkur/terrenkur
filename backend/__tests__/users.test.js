const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const users = [
  { id: 1, username: 'Alice', auth_id: null },
  { id: 2, username: 'Bob', auth_id: 'x' },
  { id: 3, username: 'Charlie', auth_id: null },
];

const build = (data) => {
  const builder = {};
  const chain = ['select', 'order', 'ilike'];
  chain.forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.then = (resolve) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
};

const buildUsers = (all) => {
  const builder = build(all);
  builder.data = all;
  builder.select = jest.fn(() => {
    builder.data = all;
    return builder;
  });
  builder.order = jest.fn(() => builder);
  builder.ilike = jest.fn((_col, pattern) => {
    const s = pattern.replace(/%/g, '').toLowerCase();
    builder.data = all.filter((u) => u.username.toLowerCase().includes(s));
    return builder;
  });
  builder.then = (resolve) => Promise.resolve({ data: builder.data, error: null }).then(resolve);
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    if (table === 'users') {
      return buildUsers(users);
    }
    return build(null);
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
      { id: 1, username: 'Alice', auth_id: null, logged_in: false },
    ]);
  });
});
