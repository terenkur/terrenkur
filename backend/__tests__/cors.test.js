const SUPABASE_URL = 'http://localhost';
const SUPABASE_KEY = 'test';

const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockSelect = jest.fn(() => ({ order: mockOrder }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

const request = require('supertest');

describe('CORS configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_KEY = SUPABASE_KEY;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URLS;
  });

  it('allows requests from one of multiple FRONTEND_URLS', async () => {
    process.env.FRONTEND_URLS = 'http://localhost:3000,https://example.com';
    const app = require('../server');
    const res = await request(app)
      .get('/api/logs?limit=1')
      .set('Origin', 'https://example.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://example.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(mockFrom).toHaveBeenCalledWith('event_logs');
  });

  it('blocks requests from origins not in FRONTEND_URLS', async () => {
    process.env.FRONTEND_URLS = 'http://localhost:3000';
    const app = require('../server');
    const res = await request(app)
      .get('/api/logs?limit=1')
      .set('Origin', 'https://example.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('defaults to wildcard when no origin configured', async () => {
    const app = require('../server');
    const res = await request(app)
      .get('/api/logs?limit=1')
      .set('Origin', 'https://random.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('handles OPTIONS requests', async () => {
    process.env.FRONTEND_URLS = 'http://localhost:3000';
    const app = require('../server');
    const res = await request(app)
      .options('/api/logs')
      .set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
