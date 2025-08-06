const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

let isModerator = true;
let upsertResult = { game_id: 1 };
let existingGame = { id: 1, name: 'Test Game' };
let insertedGame = { id: 2, name: 'New Game' };
let gamesInsert;
let playlistUpsert;
let eventLogInsert;

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
              Promise.resolve({ data: existingGame, error: null })
            ),
          })),
          ilike: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: existingGame, error: null })
            ),
          })),
          maybeSingle: jest.fn(() =>
            Promise.resolve({ data: existingGame, error: null })
          ),
        })),
        insert: (...args) => gamesInsert(...args),
      };
    }
    if (table === 'playlist_games') {
      return {
        upsert: (...args) => playlistUpsert(...args),
      };
    }
    if (table === 'event_logs') {
      return {
        insert: (...args) => eventLogInsert(...args),
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
    existingGame = { id: 1, name: 'Test Game' };
    insertedGame = { id: 2, name: 'New Game' };
    gamesInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: insertedGame, error: null })),
      })),
    }));
    playlistUpsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: upsertResult })),
      })),
    }));
    eventLogInsert = jest.fn(() => Promise.resolve({}));
    mockSupabase.from.mockClear();
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

  it('links tag to existing game by name', async () => {
    existingGame = { id: 3, name: 'Existing Game' };
    upsertResult = { game_id: 3 };
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'adventure', game_name: 'Existing Game' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 3 });
  });

  it('creates and maps new game when only name provided', async () => {
    existingGame = null;
    insertedGame = { id: 5, name: 'Name Only Game' };
    upsertResult = { game_id: 5 };
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'solo', game_name: 'Name Only Game' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 5 });
    expect(gamesInsert).toHaveBeenCalledWith({ name: 'Name Only Game' });
    expect(playlistUpsert).toHaveBeenCalledWith(
      { tag: 'solo', game_id: 5 },
      { onConflict: 'tag' }
    );
  });

  it('creates new game when not found', async () => {
    existingGame = null;
    insertedGame = { id: 4, name: 'Brand New Game' };
    upsertResult = { game_id: 4 };
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'new', game_name: 'Brand New Game', rawg_id: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 4 });
    expect(gamesInsert).toHaveBeenCalledWith({
      name: 'Brand New Game',
      rawg_id: 10,
    });
  });

  it('links tag to existing game by rawg_id', async () => {
    existingGame = { id: 6, name: 'RAWG Game' };
    upsertResult = { game_id: 6 };
    const res = await request(app)
      .post('/api/playlist_game')
      .set('Authorization', 'Bearer token')
      .send({ tag: 'rawg', rawg_id: 99 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 6 });
  });
});

