const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const users = [{ id: 1, username: 'Bob', auth_id: null, twitch_login: null }];

const buildUsers = () => {
  let filtered = users;
  const builder = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((col, val) => {
    filtered = users.filter((u) => u[col] === val);
    return builder;
  });
  builder.or = jest.fn((expr) => {
    const conditions = expr.split(',');
    filtered = users.filter((u) =>
      conditions.some((cond) => {
        const [col, op, value] = cond.split('.');
        if (op === 'ilike') {
          return (u[col] || '').toLowerCase() === value.toLowerCase();
        }
        return false;
      })
    );
    return builder;
  });
  builder.maybeSingle = jest.fn(() =>
    Promise.resolve({ data: filtered[0] || null, error: null })
  );
  builder.update = jest.fn((vals) => ({
    eq: jest.fn((col, val) => {
      const row = users.find((u) => u[col] === val);
      if (row) Object.assign(row, vals);
      return Promise.resolve({ error: null });
    }),
  }));
  return builder;
};

const mockSupabase = {
  auth: {
    getUser: jest
      .fn()
      .mockResolvedValue({
        data: { user: { id: 'auth123', user_metadata: { preferred_username: 'Bob' } } },
        error: null,
      }),
  },
  from: jest.fn((table) => {
    if (table === 'users') return buildUsers();
    return {};
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('/api/ensure-twitch-login', () => {
  it('attaches existing user row by nickname', async () => {
    const res = await request(app)
      .post('/api/ensure-twitch-login')
      .set('Authorization', 'Bearer token123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, twitch_login: 'bob' });
    expect(users[0]).toMatchObject({
      auth_id: 'auth123',
      twitch_login: 'bob',
    });
  });
});
