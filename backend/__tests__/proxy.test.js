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

    const res = await request(app).get(
      '/api/proxy?url=https://static-cdn.jtvnw.net/data'
    );

    expect(res.status).toBe(200);
    expect(res.text).toBe('hello');
    expect(res.header['access-control-allow-origin']).toBe('*');
  });

  it('allows media.rawg.io host', async () => {
    const mockResponse = new Response('img', {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const res = await request(app).get(
      '/api/proxy?url=https://media.rawg.io/media/games/test.jpg'
    );
    expect(res.status).toBe(200);
  });

  it('allows i.ytimg.com host', async () => {
    const mockResponse = new Response('img', {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const res = await request(app).get(
      '/api/proxy?url=https://i.ytimg.com/vi/abc/default.jpg'
    );
    expect(res.status).toBe(200);
  });

  it('rejects disallowed hosts', async () => {
    const res = await request(app).get(
      '/api/proxy?url=https://example.com/data'
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid urls', async () => {
    const res = await request(app).get('/api/proxy?url=not a url');
    expect(res.status).toBe(400);
  });
});
