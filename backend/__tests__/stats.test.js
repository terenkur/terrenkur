const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const votes = [
  { game_id: 1, user_id: 1, poll_id: 1 },
  { game_id: 1, user_id: 2, poll_id: 1 },
  { game_id: 2, user_id: 1, poll_id: 2 },
  { game_id: 1, user_id: 99, poll_id: 3 },
  { game_id: 2, user_id: 99, poll_id: 4 },
  { game_id: 1, user_id: 99, poll_id: 5 },
];
const games = [
  { id: 1, name: 'Game1' },
  { id: 2, name: 'Game2' },
];
const pollGames = [{ game_id: 1 }, { game_id: 1 }, { game_id: 2 }];
const users = [
  {
    id: 1,
    username: 'Alice',
    intim_no_tag_0: 2,
    intim_with_tag_69: 1,
    poceluy_no_tag_0: 3,
    poceluy_with_tag_69: 2,
    total_streams_watched: 50,
    total_subs_gifted: 5,
    total_subs_received: 2,
    total_chat_messages_sent: 100,
    total_times_tagged: 10,
    total_commands_run: 20,
    total_months_subbed: 3,
    combo_commands: 0,
    clips_created: 3,
  },
  {
    id: 2,
    username: 'Bob',
    intim_no_tag_0: 5,
    poceluy_no_tag_0: 4,
    poceluy_with_tag_69: 0,
    total_streams_watched: 40,
    total_subs_gifted: 1,
    total_subs_received: 5,
    total_chat_messages_sent: 80,
    total_times_tagged: 8,
    total_commands_run: 15,
    total_months_subbed: 6,
    combo_commands: 0,
    clips_created: 1,
  },
  {
    id: 3,
    username: 'Carol',
    intim_no_tag_0: 10,
    poceluy_no_tag_0: 6,
    poceluy_with_tag_69: 3,
    total_streams_watched: 30,
    total_subs_gifted: 3,
    total_subs_received: 4,
    total_chat_messages_sent: 60,
    total_times_tagged: 6,
    total_commands_run: 25,
    total_months_subbed: 1,
    combo_commands: 0,
    clips_created: 2,
  },
  {
    id: 4,
    username: 'Dave',
    intim_no_tag_0: 7,
    intim_with_tag_69: 3,
    poceluy_no_tag_0: 8,
    poceluy_with_tag_69: 1,
    total_streams_watched: 20,
    total_subs_gifted: 2,
    total_subs_received: 3,
    total_chat_messages_sent: 50,
    total_times_tagged: 4,
    total_commands_run: 5,
    total_months_subbed: 2,
    combo_commands: 0,
    clips_created: 4,
  },
  {
    id: 5,
    username: 'Eve',
    intim_no_tag_0: 1,
    poceluy_no_tag_0: 5,
    total_streams_watched: 10,
    total_subs_gifted: 4,
    total_subs_received: 1,
    total_chat_messages_sent: 40,
    total_times_tagged: 2,
    total_commands_run: 12,
    total_months_subbed: 5,
    combo_commands: 0,
    clips_created: 5,
  },
  {
    id: 6,
    username: 'Frank',
    intim_no_tag_0: 9,
    poceluy_no_tag_0: 2,
    total_streams_watched: 60,
    total_subs_gifted: 0,
    total_subs_received: 0,
    total_chat_messages_sent: 30,
    total_times_tagged: 0,
    total_commands_run: 8,
    total_months_subbed: 4,
    combo_commands: 0,
    clips_created: 6,
  },
  {
    id: 7,
    username: 'Grace',
    intim_no_tag_0: 4,
    poceluy_no_tag_0: 1,
    poceluy_with_tag_69: 4,
    total_streams_watched: 25,
    total_subs_gifted: 6,
    total_subs_received: 7,
    total_chat_messages_sent: 20,
    total_times_tagged: 1,
    total_commands_run: 3,
    total_months_subbed: 7,
    combo_commands: 0,
    clips_created: 7,
  },
  {
    id: 99,
    username: 'StreamElements',
    intim_no_tag_0: 1000,
    intim_with_tag_69: 1000,
    poceluy_no_tag_0: 1000,
    poceluy_with_tag_69: 1000,
    total_streams_watched: 1000,
    total_subs_gifted: 1000,
    total_subs_received: 1000,
    total_chat_messages_sent: 1000,
    total_times_tagged: 1000,
    total_commands_run: 1000,
    total_months_subbed: 1000,
    combo_commands: 1000,
    clips_created: 1000,
  },
];

const build = (data) => {
  const builder = {};
  const chain = ['select', 'eq', 'order', 'limit', 'in', 'insert', 'update', 'upsert', 'delete'];
  chain.forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.maybeSingle = jest.fn(async () => ({ data: builder.data ?? data, error: null }));
  builder.single = jest.fn(async () => ({ data: builder.data ?? data, error: null }));
  builder.then = (resolve) => Promise.resolve({ data: builder.data ?? data, error: null }).then(resolve);
  return builder;
};

const buildGames = (all) => {
  const builder = build(all);
  builder.data = all;
  builder.in = jest.fn((_col, ids) => {
    builder.data = all.filter((g) => ids.includes(g.id));
    return builder;
  });
  return builder;
};

const buildUsers = (all) => {
  const builder = build(all);
  builder.data = all;
  builder.in = jest.fn((_col, ids) => {
    builder.data = all.filter((u) => ids.includes(u.id));
    return builder;
  });
  return builder;
};

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn((table) => {
    switch (table) {
      case 'votes':
        return build(votes);
      case 'poll_games':
        return build(pollGames);
      case 'games':
        return buildGames(games);
      case 'users':
        return buildUsers(users);
      default:
        return build(null);
    }
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('stats endpoints', () => {
  it('returns aggregated game votes', async () => {
    const res = await request(app).get('/api/stats/popular-games');
    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([
      { id: 1, name: 'Game1', votes: 4 },
      { id: 2, name: 'Game2', votes: 2 },
    ]);
  });

  it('returns aggregated user votes', async () => {
    const res = await request(app).get('/api/stats/top-voters');
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([
      { id: 1, username: 'Alice', votes: 2 },
      { id: 2, username: 'Bob', votes: 1 },
    ]);
  });

  it('returns roulette counts per game', async () => {
    const res = await request(app).get('/api/stats/game-roulettes');
    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([
      { id: 1, name: 'Game1', roulettes: 2 },
      { id: 2, name: 'Game2', roulettes: 1 },
    ]);
  });

  it('returns users ranked by distinct roulettes', async () => {
    const res = await request(app).get('/api/stats/top-roulette-users');
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([
      { id: 1, username: 'Alice', roulettes: 2 },
      { id: 2, username: 'Bob', roulettes: 1 },
    ]);
  });

  it('returns top intim stats sorted and limited', async () => {
    const res = await request(app).get('/api/stats/intim');
    expect(res.status).toBe(200);
    expect(res.body.stats.intim_no_tag_0).toEqual([
      { id: 3, username: 'Carol', value: 10 },
      { id: 6, username: 'Frank', value: 9 },
      { id: 4, username: 'Dave', value: 7 },
      { id: 2, username: 'Bob', value: 5 },
      { id: 7, username: 'Grace', value: 4 },
    ]);
    expect(res.body.stats.intim_no_tag_0).toHaveLength(5);
    expect(res.body.stats.intim_with_tag_69).toEqual([
      { id: 4, username: 'Dave', value: 3 },
      { id: 1, username: 'Alice', value: 1 },
    ]);
  });

  it('returns top poceluy stats sorted and limited', async () => {
    const res = await request(app).get('/api/stats/poceluy');
    expect(res.status).toBe(200);
    expect(res.body.stats.poceluy_no_tag_0).toEqual([
      { id: 4, username: 'Dave', value: 8 },
      { id: 3, username: 'Carol', value: 6 },
      { id: 5, username: 'Eve', value: 5 },
      { id: 2, username: 'Bob', value: 4 },
      { id: 1, username: 'Alice', value: 3 },
    ]);
    expect(res.body.stats.poceluy_no_tag_0).toHaveLength(5);
    expect(res.body.stats.poceluy_with_tag_69).toEqual([
      { id: 7, username: 'Grace', value: 4 },
      { id: 3, username: 'Carol', value: 3 },
      { id: 1, username: 'Alice', value: 2 },
      { id: 4, username: 'Dave', value: 1 },
    ]);
  });

  it('returns top total stats sorted and limited', async () => {
    const res = await request(app).get('/api/stats/totals');
    expect(res.status).toBe(200);
    expect(res.body.stats.total_streams_watched).toEqual([
      { id: 6, username: 'Frank', value: 60 },
      { id: 1, username: 'Alice', value: 50 },
      { id: 2, username: 'Bob', value: 40 },
      { id: 3, username: 'Carol', value: 30 },
      { id: 7, username: 'Grace', value: 25 },
    ]);
    expect(res.body.stats.total_streams_watched).toHaveLength(5);
    expect(res.body.stats.total_subs_gifted).toEqual([
      { id: 7, username: 'Grace', value: 6 },
      { id: 1, username: 'Alice', value: 5 },
      { id: 5, username: 'Eve', value: 4 },
      { id: 3, username: 'Carol', value: 3 },
      { id: 4, username: 'Dave', value: 2 },
    ]);
    expect(res.body.stats.clips_created).toEqual([
      { id: 7, username: 'Grace', value: 7 },
      { id: 6, username: 'Frank', value: 6 },
      { id: 5, username: 'Eve', value: 5 },
      { id: 4, username: 'Dave', value: 4 },
      { id: 1, username: 'Alice', value: 3 },
    ]);
  });

  it('excludes users in EXCLUDED_MEDAL_USERNAMES from stats responses', async () => {
    const excluded = 'StreamElements';

    const endpoints = [
      { url: '/api/stats/intim', key: 'stats' },
      { url: '/api/stats/poceluy', key: 'stats' },
      { url: '/api/stats/totals', key: 'stats' },
      { url: '/api/stats/top-voters', key: 'users' },
      { url: '/api/stats/top-roulette-users', key: 'users' },
    ];

    for (const ep of endpoints) {
      const res = await request(app).get(ep.url);
      expect(res.status).toBe(200);
      const container = res.body[ep.key];
      if (Array.isArray(container)) {
        expect(container.some((u) => u.username === excluded)).toBe(false);
      } else {
        for (const arr of Object.values(container)) {
          expect(arr.some((u) => u.username === excluded)).toBe(false);
        }
      }
    }
  });
});
