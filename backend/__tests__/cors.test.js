process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';

const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockSelect = jest.fn(() => ({ order: mockOrder }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

const request = require('supertest');
const app = require('../server');

describe('CORS configuration', () => {
  it('allows requests from FRONTEND_URL to event logs', async () => {
    const res = await request(app)
      .get('/api/logs?limit=1')
      .set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(mockFrom).toHaveBeenCalledWith('event_logs');
  });
});
