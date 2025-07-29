const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const mockSupabase = {
  auth: {
    getUser: jest.fn(() => ({ data: { user: { id: '1' } }, error: null })),
  },
  from: jest.fn((table) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ maybeSingle: jest.fn(() => Promise.resolve({ data: { is_moderator: true } })) }))
    })),
    upsert: jest.fn(() => ({
      onConflict: jest.fn(() => ({ maybeSingle: jest.fn(() => Promise.resolve({ data: {} })) }))
    })),
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { id: 1 } })) })) })),
    update: jest.fn(() => ({ eq: jest.fn(() => ({}) ) })),
  })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('POST /api/manage_game', () => {
  it('requires game_id or name/rawg_id', async () => {
    const res = await request(app)
      .post('/api/manage_game')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(400);
  });
});
