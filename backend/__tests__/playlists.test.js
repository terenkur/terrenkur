const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
process.env.YOUTUBE_API_KEY = 'key';
process.env.YOUTUBE_CHANNEL_ID = 'channel';

const tagMap = {
  rpg: [
    {
      id: 'v1',
      title: 'Video1',
      description: '',
      publishedAt: '2024-01-01',
      thumbnail: null,
    },
  ],
};

jest.mock('../youtube', () => ({
  getPlaylists: jest.fn(() => Promise.resolve(tagMap)),
}));

const build = (data) => ({
  select: jest.fn(() => ({
    in: jest.fn(() => Promise.resolve({ data, error: null })),
  })),
});

const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'playlist_games') {
      return build([{ tag: 'rpg', game_id: 1 }]);
    }
    if (table === 'games') {
      return build([{ id: 1, name: 'Game1', background_image: 'img.png' }]);
    }
    return build([]);
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('GET /api/playlists', () => {
  it('returns playlists with game information', async () => {
    const res = await request(app).get('/api/playlists');
    expect(res.status).toBe(200);
    expect(res.body.rpg.videos[0].id).toBe('v1');
    expect(res.body.rpg.game).toEqual({
      id: 1,
      name: 'Game1',
      background_image: 'img.png',
    });
  });
});

