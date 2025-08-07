const request = require('supertest');

const mockTokenRow = { id: 1, refresh_token: 'ref' };
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

describe('/refresh-token/donationalerts', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_KEY = 'test';
    process.env.DONATIONALERTS_CLIENT_ID = 'id';
    process.env.DONATIONALERTS_SECRET = 'secret';
    process.env.DONATIONALERTS_REFRESH_TOKEN = 'env';
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
    const res = await request(app).post('/refresh-token/donationalerts');
    expect(res.status).toBe(200);
    expect(mockBuilder.select).toHaveBeenCalledWith('id, refresh_token');
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
    const res = await request(app).post('/refresh-token/donationalerts');
    expect(res.status).toBe(400);
    expect(mockBuilder.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

