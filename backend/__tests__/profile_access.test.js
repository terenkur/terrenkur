const request=require('supertest');
process.env.SUPABASE_URL='http://localhost'; process.env.SUPABASE_KEY='fixture';
const mockGetUser=jest.fn(); const mockFrom=jest.fn();
jest.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:mockGetUser},from:mockFrom})}));
const app=require('../server');
beforeEach(()=>{jest.clearAllMocks();mockGetUser.mockResolvedValue({data:{user:{id:'staff',app_metadata:{provider:'email',site_moderator:true}}}});});
it.each(['/api/me','/api/twitch-rewards','/api/obs-media'])('rejects anonymous access to %s',async url=>{
 expect((await request(app).get(url)).status).toBe(401); expect(mockFrom).not.toHaveBeenCalled();
});
it('returns staff access without creating a participant profile',async()=>{
 const res=await request(app).get('/api/me').set('Authorization','Bearer fixture');
 expect(res.status).toBe(200);expect(res.body.user).toMatchObject({auth_id:'staff',is_moderator:true});
 expect(res.headers['cache-control']).toBe('no-store');expect(mockFrom).not.toHaveBeenCalled();
});
it.each(['/api/me','/api/twitch-rewards','/api/obs-media'])('rejects an old channel moderator on %s',async url=>{
 mockGetUser.mockResolvedValue({data:{user:{id:'old',app_metadata:{provider:'twitch',role:'moderator'},user_metadata:{site_moderator:true}}}});
 expect((await request(app).get(url).set('Authorization','Bearer old')).status).toBe(403);
 expect(mockFrom).not.toHaveBeenCalled();
});
it('protects playback mutation',async()=>{expect((await request(app).post('/api/music-queue/1/start')).status).toBe(401);});
it('has a health endpoint',async()=>{expect((await request(app).get('/healthz')).body).toEqual({status:'ok'});});

it('requires a moderator to change queue autostart and persists the requested mode', async () => {
  const endpoint = '/api/music-queue/autostart';
  expect((await request(app).post(endpoint).send({ enabled: false })).status).toBe(401);
  const upsert = jest.fn().mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ upsert });
  const response = await request(app).post(endpoint).set('Authorization', 'Bearer fixture').send({ enabled: false });
  expect(response.body).toEqual({ autoStart: false });
  expect(upsert).toHaveBeenCalledWith({ key: 'music_queue_auto_start', value: 0 });
});

it('does not start an automatic track when the saved mode is off', async () => {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { value: 0 }, error: null }) };
  mockFrom.mockReturnValue(query);
  const response = await request(app).post('/api/music-queue/1/start?automatic=true').set('Authorization', 'Bearer fixture');
  expect(response.body).toEqual({ autoStart: false });
  expect(mockFrom.mock.calls).toEqual([['settings']]);
});

describe('player links', () => {
  const token = 'ab'.repeat(32);
  const savedToken = process.env.MUSIC_QUEUE_PLAYER_TOKEN;
  beforeEach(() => { process.env.MUSIC_QUEUE_PLAYER_TOKEN = token; });
  afterEach(() => {
    if (savedToken === undefined) delete process.env.MUSIC_QUEUE_PLAYER_TOKEN;
    else process.env.MUSIC_QUEUE_PLAYER_TOKEN = savedToken;
  });
  it('checks player access without a moderator session', async () => {
    const response = await request(app).get('/api/music-queue/player-access').set('X-Music-Player-Token', token);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ canPlay: true });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mockGetUser).not.toHaveBeenCalled();
  });
  it.each(['/api/me', '/api/obs-media', '/api/music-queue/next'])('does not grant moderator access to %s', async path => {
    expect((await request(app).get(path).set('X-Music-Player-Token', token)).status).toBe(401);
  });
  it('cannot change autostart or bypass a paused queue', async () => {
    expect((await request(app).post('/api/music-queue/autostart').set('X-Music-Player-Token', token).send({ enabled: true })).status).toBe(401);
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { value: 0 }, error: null }) };
    mockFrom.mockReturnValue(query);
    const response = await request(app).post('/api/music-queue/1/start').set('X-Music-Player-Token', token);
    expect(response.body).toEqual({ autoStart: false });
  });
  it.each(['start', 'complete', 'skip'])('rejects invalid player credentials for %s before accessing data', async action => {
    const response = await request(app).post(`/api/music-queue/1/${action}`).set('X-Music-Player-Token', 'cd'.repeat(32));
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each(['complete', 'skip'])('can %s the active track without login', async action => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 1, status: 'in_progress' }, error: null }) };
    mockFrom.mockReturnValue(query);
    const response = await request(app).post(`/api/music-queue/1/${action}`).set('X-Music-Player-Token', token);
    expect(response.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: action === 'complete' ? 'completed' : 'skipped' }));
    expect(mockGetUser).not.toHaveBeenCalled();
  });
  it('cannot skip requests that have not started', async () => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 1, status: 'pending' }, error: null }) };
    mockFrom.mockReturnValue(query);
    expect((await request(app).post('/api/music-queue/1/skip').set('X-Music-Player-Token', token)).status).toBe(403);
    expect(query.update).not.toHaveBeenCalled();
  });
  it('starts a queued track with the dedicated token', async () => {
    const result = data => ({ data, error: null });
    const settings = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result({ value: 1 })) };
    const item = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result({ id: 1, status: 'pending' })) };
    const active = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(result([])) };
    const update = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result({ id: 1, status: 'in_progress' })) };
    mockFrom.mockReturnValueOnce(settings).mockReturnValueOnce(item).mockReturnValueOnce(active).mockReturnValueOnce(update);
    const response = await request(app).post('/api/music-queue/1/start?automatic=true').set('X-Music-Player-Token', token);
    expect(response.status).toBe(200);
    expect(response.body.item.status).toBe('in_progress');
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
