const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: [] })) })),
    })),
  })),
}));

const app = require('../server');

describe('POST /api/vote', () => {
  it('requires authorization', async () => {
    const res = await request(app).post('/api/vote').send({ poll_id: 1 });
    expect(res.status).toBe(401);
  });
});
