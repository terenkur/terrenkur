const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

let isModerator = true;
let upsertResult = { game_id: 1 };

const mockSupabase = {
  auth: {
    getUser: jest.fn(() => ({ data: { user: { id: '1', email: 'mod@test' } }, error: null })),
  },
  from: jest.fn((table) => {
    if (table === 'users') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: { is_moderator: isModerator } })
            ),
          })),
        })),
      };
    }
    if (table === 'games') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: { id: 1, name: 'Test Game' } })
            ),
          })),
        })),
      };
    }
    if (table === 'playlist_games') {
      return {
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: upsertResult })),
          })),
        })),
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
  beforeEach(() => {
    isModerator = true;
    upsertResult = { game_id: 1 };
  });

  it('forbids non-moderators', async () => {
    isModerator = false;
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'rpg', game_id: 1 });
    expect(res.status).toBe(403);
  });

  it('creates mapping for a playlist tag', async () => {
    upsertResult = { game_id: 1 };
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'rpg', game_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 1 });
  });

  it('updates existing mapping', async () => {
    upsertResult = { game_id: 2 };
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'rpg', game_id: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 2 });
  });
});

