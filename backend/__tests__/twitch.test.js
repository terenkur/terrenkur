const request = require('supertest');

const mockTokenRow = { id: 1, access_token: 'token', refresh_token: 'ref' };
const mockBuilder = {
  select: jest.fn(() => mockBuilder),
  update: jest.fn(() => mockBuilder),
  insert: jest.fn(async () => ({ data: null, error: null })),
  maybeSingle: jest.fn(async () => ({ data: mockTokenRow, error: null })),
  eq: jest.fn(async () => ({ data: null, error: null })),
};
const mockFrom = jest.fn(() => mockBuilder);

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

describe('/api/streamer-token', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_KEY = 'test';
    process.env.ENABLE_TWITCH_ROLE_CHECKS = 'true';
    mockTokenRow.access_token = 'abc';
    app = require('../server');
  });

  it('returns the stored token', async () => {
    const res = await request(app).get('/api/streamer-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: 'abc' });
    expect(mockFrom).toHaveBeenCalledWith('twitch_tokens');
  });
});

describe('/refresh-token', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_KEY = 'test';
    process.env.TWITCH_CLIENT_ID = 'id';
    process.env.TWITCH_SECRET = 'secret';
    process.env.TWITCH_REFRESH_TOKEN = 'env';
    delete process.env.ENABLE_TWITCH_ROLE_CHECKS;
    mockTokenRow.refresh_token = 'old';
    app = require('../server');
  });

  it('writes new tokens to supabase', async () => {
    const mockResp = new Response(
      JSON.stringify({
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        expires_in: 60,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(mockResp);
    const res = await request(app).get('/refresh-token');
    expect(res.status).toBe(200);
    expect(mockBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'new_access',
        refresh_token: 'new_refresh',
      })
    );
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', mockTokenRow.id);
    spy.mockRestore();
  });

  it('handles failed refreshes', async () => {
    const mockResp = new Response('bad', { status: 400 });
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(mockResp);
    const res = await request(app).get('/refresh-token');
    expect(res.status).toBe(400);
    expect(mockBuilder.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

