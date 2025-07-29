process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
const request = require('supertest');
const app = require('../server');

describe('GET /api/proxy', () => {
  it('returns proxied data', async () => {
    const mockResponse = new Response('hello', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const res = await request(app).get('/api/proxy?url=http://example.com/data');

    expect(res.status).toBe(200);
    expect(res.text).toBe('hello');
    expect(res.header['access-control-allow-origin']).toBe('*');
  });
});
