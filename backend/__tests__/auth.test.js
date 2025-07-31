process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
process.env.TWITCH_CLIENT_ID = 'id';
process.env.TWITCH_SECRET = 'secret';
process.env.OAUTH_CALLBACK_URL = 'http://localhost/auth/callback';

const request = require('supertest');
const app = require('../server');

describe('POST /auth/twitch-token', () => {
  it('proxies code exchange to Twitch', async () => {
    const mockResp = new Response('{"access_token":"t"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(mockResp);

    const res = await request(app)
      .post('/auth/twitch-token')
      .send({ code: 'abc' });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      'https://id.twitch.tv/oauth2/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('requires code parameter', async () => {
    const res = await request(app).post('/auth/twitch-token').send({});
    expect(res.status).toBe(400);
  });
});
