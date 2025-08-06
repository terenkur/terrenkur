const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const mockSupabase = {
  auth: {
    getUser: jest.fn(() => ({ data: { user: { id: '1', email: 'mod@test' } }, error: null })),
  },
  from: jest.fn((table) => {
    if (table === 'users') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: { is_moderator: true } }))
          }))
        }))
      };
    }
    if (table === 'games') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: { id: 1, name: 'Test Game' } }))
          }))
        }))
      };
    }
    if (table === 'playlist_games') {
      return {
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { game_id: 1 } }))
          }))
        }))
      };
    }
    if (table === 'event_logs') {
      return {
        insert: jest.fn(() => Promise.resolve({})),
      };
    }
    return {};
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('POST /api/playlist_game', () => {
  it('requires tag and game_id', async () => {
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(400);
  });

  it('upserts mapping', async () => {
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'rpg', game_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 1 });
  });
});
