const request = require('supertest');
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'fixture';
const mockRows = {
  users: [{ id: 1, auth_id: 'a', username: 'alice', is_moderator: false }, { id: 2, auth_id: 'b', username: 'bob', is_moderator: true }],
  votes: [{ user_id: 1, poll_id: 5, game_id: 3, slot: 1 }, { user_id: 2, poll_id: 5, game_id: 4, slot: 1 }],
};
const mockGetUser = jest.fn(async () => ({ data: { user: { id: 'a', user_metadata: { is_moderator: true } } }, error: null }));
const mockFrom = jest.fn(table => {
  let rows = mockRows[table] || [];
  const q = {
    select: () => q,
    eq: (key, value) => { rows = rows.filter(row => row[key] === value); return q; },
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: resolve => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return q;
});
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }) }));
const app = require('../server');
beforeEach(() => jest.clearAllMocks());
it.each(['/api/me', '/api/my-votes?poll_id=5', '/api/twitch-rewards'])('rejects anonymous access to %s', async path => {
  expect((await request(app).get(path)).status).toBe(401);
  expect(mockFrom).not.toHaveBeenCalled();
});
it('returns only the authenticated profile and does not elevate metadata', async () => {
  const res = await request(app).get('/api/me?auth_id=b').set('Authorization', 'Bearer fixture');
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({ id: 1, auth_id: 'a', is_moderator: false });
  expect(res.headers['cache-control']).toBe('no-store');
});
it('filters private votes by the authenticated profile even when another owner is requested', async () => {
  const res = await request(app).get('/api/my-votes?poll_id=5&user_id=2').set('Authorization', 'Bearer fixture');
  expect(res.status).toBe(200); expect(res.body.votes).toHaveLength(1);
  expect(res.body.votes[0].user_id).toBe(1);
});
it('rejects a non-moderator with forged user_metadata on moderator routes', async () => {
  const res = await request(app).get('/api/twitch-rewards').set('Authorization', 'Bearer fixture');
  expect(res.status).toBe(403); expect(mockRows.users[0].is_moderator).toBe(false);
});
it('protects music playback changes even without a configuration flag', async () => {
  expect((await request(app).post('/api/music-queue/1/start')).status).toBe(401);
});
it('has a process health endpoint', async () => {
  const res = await request(app).get('/healthz');
  expect(res.status).toBe(200); expect(res.body).toEqual({ status: 'ok' });
});
