const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
process.env.YOUTUBE_API_KEY = 'yt';
process.env.YOUTUBE_CHANNEL_ID = 'chan';

const game = { id: 1, name: 'Game1', status: 'backlog', rating: 5, selection_method: 'donation', background_image: null };
const initRows = [{ user_id: 1 }];
const pollGames = [{ poll_id: 10 }, { poll_id: 11 }];
const polls = [
  { id: 10, created_at: '2024-01-01', archived: false },
  { id: 11, created_at: '2024-02-01', archived: true },
];
const pollResults = [{ poll_id: 10, winner_id: 2 }];
const votes = [
  { poll_id: 10, user_id: 1 },
  { poll_id: 10, user_id: 1 },
  { poll_id: 11, user_id: 2 },
];
const users = [
  { id: 1, username: 'Alice' },
  { id: 2, username: 'Bob' },
];
const playlistGame = { tag: 'rpg' };
const playlistMap = {
  rpg: [
    {
      id: 'v1',
      title: 'Video1',
      description: '',
      publishedAt: '2024-03-01',
      thumbnail: null,
    },
  ],
};

const winnerGames = [
  { id: 2, name: 'WinnerGame', background_image: 'win.jpg' },
];
let gamesCall = 0;

const build = (data) => {
  const builder = {};
  const chain = ['select', 'eq', 'order', 'limit', 'in', 'insert', 'update', 'upsert', 'delete'];
  chain.forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.maybeSingle = jest.fn(async () => ({ data, error: null }));
  builder.single = jest.fn(async () => ({ data, error: null }));
  builder.then = (resolve) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    switch (table) {
      case 'games':
        return build(gamesCall++ === 0 ? game : winnerGames);
      case 'game_initiators':
        return build(initRows);
      case 'users':
        return build(users);
      case 'poll_games':
        return build(pollGames);
      case 'polls':
        return build(polls);
      case 'poll_results':
        return build(pollResults);
      case 'votes':
        return build(votes);
      case 'playlist_games':
        return build(playlistGame);
      default:
        return build(null);
    }
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockGetPlaylists = jest.fn(async () => playlistMap);
jest.mock('../youtube', () => ({
  getPlaylists: (...args) => mockGetPlaylists(...args),
}));

const app = require('../server');

describe('GET /api/games/:id', () => {
  it('returns game info with polls and voters', async () => {
    const res = await request(app).get('/api/games/1');
    expect(res.status).toBe(200);
    expect(res.body.game.name).toBe('Game1');
    expect(res.body.game.initiators).toEqual([{ id: 1, username: 'Alice' }]);
    expect(res.body.polls.length).toBe(2);
    const poll = res.body.polls.find((p) => p.id === 10);
    expect(poll.winnerId).toBe(2);
    expect(poll.winnerName).toBe('WinnerGame');
    expect(poll.winnerBackground).toBe('win.jpg');
    expect(poll.voters).toEqual([{ id: 1, username: 'Alice', count: 2 }]);
    expect(res.body.playlist.tag).toBe('rpg');
    expect(res.body.playlist.videos[0].title).toBe('Video1');
    expect(mockGetPlaylists).toHaveBeenCalledWith('yt', 'chan', ['rpg']);
  });
});
