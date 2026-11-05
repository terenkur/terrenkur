const express = require('express');
const request = require('supertest');
const { createMusicControl } = require('../music-control');
const { createSecurity } = require('../security');

const token = 'ab'.repeat(32);
let settings, rows, app, broadcast;
const savedToken = process.env.MUSIC_QUEUE_PLAYER_TOKEN;
beforeEach(() => {
  process.env.MUSIC_QUEUE_PLAYER_TOKEN = token;
  settings = new Map();
  rows = [{ id: 1, status: 'completed', title: 'Old song', url: 'https://youtu.be/aaaaaaaaaaa' }];
  const supabase = { auth: { getUser: jest.fn() }, from: table => {
    let selectedId, inserted;
    const query = {
      select: () => query,
      in: async (_column, names) => ({ data: names.filter(key => settings.has(key)).map(key => ({ key, value: settings.get(key) })) }),
      eq: (_column, id) => { selectedId = id; return query; },
      maybeSingle: async () => ({ data: rows.find(row => row.id === selectedId) || null }),
      upsert: async entries => { entries.forEach(row => settings.set(row.key, row.value)); return {}; },
      insert: entry => { inserted = { ...entry, id: rows.length + 1 }; rows.push(inserted); return query; },
      single: async () => ({ data: inserted }),
    };
    if (!['settings', 'music_queue'].includes(table)) throw new Error('Unexpected table');
    return query;
  } };
  broadcast = jest.fn();
  app = express(); app.use(express.json());
  app.use('/control', createMusicControl({ supabase,
    requireMusicPlayer: createSecurity(supabase).requireMusicPlayer,
    fetchQueue: async () => ({ active: null, queue: rows.filter(r => r.status === 'pending'), history: rows.filter(r => r.status === 'completed') }), broadcast,
  }));
});
afterAll(() => {
  if (savedToken === undefined) delete process.env.MUSIC_QUEUE_PLAYER_TOKEN;
  else process.env.MUSIC_QUEUE_PLAYER_TOKEN = savedToken;
});
const post = (path, body) => request(app).post(`/control${path}`).set('X-Music-Player-Token', token).send(body);
const get = path => request(app).get(`/control${path}`).set('X-Music-Player-Token', token);

it('requires valid token for every control endpoint', async () => {
  expect((await request(app).get('/control')).status).toBe(401);
  expect((await request(app).post('/control/settings').send({ paused: true })).status).toBe(401);
  expect((await request(app).post('/control/1/replay')).status).toBe(401);
  expect((await request(app).post('/control/heartbeat').send({ state: 1, trackId: 1 })).status).toBe(401);
});
it('persists remote controls and reads them from an independent request', async () => {
  expect((await post('/settings', { paused: true, volume: 24, muted: true, autoStart: false })).status).toBe(200);
  const result = await get('/playback');
  expect(result.body).toMatchObject({ paused: true, volume: 24, muted: true, autoStart: false, online: false });
  expect(result.headers['cache-control']).toBe('no-store');
  await post('/settings', { paused: false });
  expect((await get('/playback')).body).toMatchObject({ paused: false, volume: 24, muted: true });
  expect(broadcast).toHaveBeenCalled();
});
it.each([{ paused: 'true' }, { volume: -1 }, { volume: 101 }, { volume: 0.5 }, { lastSeen: 123 }, {}, { unknown: true }])('rejects malformed settings %p', async input => {
  expect((await post('/settings', input)).status).toBe(400);
  expect(settings.size).toBe(0);
});
it('reports actual playback and expires stale heartbeats', async () => {
  await post('/heartbeat', { state: 2, trackId: 5 });
  expect((await get('/playback')).body).toMatchObject({ online: true, state: 2, trackId: 5 });
  settings.set('music_player_seen', Date.now() - 16000);
  expect((await get('/playback')).body.online).toBe(false);
});

it('relays playback failures and clears them when the player recovers', async () => {
  await post('/heartbeat', { state: -1, trackId: 5, failure: 1000 });
  expect((await get('/playback')).body).toMatchObject({ online: true, failure: 1000 });
  await post('/heartbeat', { state: 1, trackId: 5, failure: 0 });
  expect((await get('/playback')).body).toMatchObject({ state: 1, failure: 0 });
  expect((await post('/heartbeat', { state: -1, trackId: 5, failure: '1000' })).status).toBe(400);
});
it('rejects invalid playback reports', async () => {
  expect((await post('/heartbeat', { state: 42, trackId: 1 })).status).toBe(400);
  expect((await post('/heartbeat', { state: 1, trackId: '1' })).status).toBe(400);
});
it('replays history as a new queued request without changing history', async () => {
  const result = await post('/1/replay', {});
  expect(result.status).toBe(200);
  expect(result.body.item).toMatchObject({ id: 2, status: 'pending', title: 'Old song' });
  expect(rows[0].status).toBe('completed');
  const snapshot = (await get('')).body;
  expect(snapshot.queue).toHaveLength(1); expect(snapshot.history).toHaveLength(1);
});
it('does not replay an active track or nonexistent request', async () => {
  rows[0].status = 'in_progress';
  expect((await post('/1/replay', {})).status).toBe(409);
  expect((await post('/999/replay', {})).status).toBe(404);
  expect(rows).toHaveLength(1);
});
