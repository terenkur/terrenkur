const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
process.env.YOUTUBE_API_KEY = 'yt';
process.env.YOUTUBE_CHANNEL_ID = 'chan';

const poll = { id: 1 };
const pollGames = [{ game_id: 2 }];
const games = [
  {
    id: 1,
    rawg_id: 1,
    name: 'Alpha',
    status: 'backlog',
    rating: 7,
    selection_method: 'roulette',
    background_image: null,
    released_year: 2010,
    genres: ['rpg', 'strategy'],
  },
  {
    id: 2,
    rawg_id: 2,
    name: 'Bravo',
    status: 'backlog',
    rating: 9,
    selection_method: 'donation',
    background_image: null,
    released_year: 2015,
    genres: ['action'],
  },
  {
    id: 3,
    rawg_id: 3,
    name: 'Charlie',
    status: 'completed',
    rating: 5,
    selection_method: 'points',
    background_image: null,
    released_year: 2005,
    genres: ['strategy', 'puzzle'],
  },
];
const initRows = [
  { game_id: 1, user_id: 1 },
  { game_id: 2, user_id: 2 },
];
const users = [
  { id: 1, username: 'Alice' },
  { id: 2, username: 'Bob' },
];

const build = (data) => {
  const builder = {};
  ['select', 'eq', 'order', 'limit'].forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.maybeSingle = jest.fn(async () => ({ data, error: null }));
  builder.then = (resolve) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
};

const mockSupabase = {
  from: jest.fn((table) => {
    switch (table) {
      case 'polls':
        return build(poll);
      case 'poll_games':
        return build(pollGames);
      case 'games':
        return build(games);
      case 'game_initiators':
        return build(initRows);
      case 'users':
        return build(users);
      default:
        return build(null);
    }
  }),
  auth: { getUser: jest.fn() },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('GET /api/games filtering', () => {
  it('filters games and returns available genres', async () => {
    const res = await request(app).get('/api/games').query({
      search: 'br',
      status: 'active',
      method: 'donation',
      genres: 'action',
      yearMin: '2010',
      yearMax: '2020',
      ratingMin: '8',
      ratingMax: '10',
    });
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].id).toBe(2);
    expect(res.body.availableGenres).toEqual([
      'action',
      'puzzle',
      'rpg',
      'strategy',
    ]);
  });
});
