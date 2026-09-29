process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';
const request = require('supertest');
const app = require('../server');
it.each([
 ['post','/auth/twitch-token'], ['post','/api/ensure-twitch-login'],
 ['post','/api/vote'], ['get','/api/my-votes'], ['get','/api/get-stream'],
 ['get','/api/user/theme'], ['post','/api/user/theme'],
 ['get','/api/user/facts'], ['post','/api/user/facts'],
])('removes visitor route %s %s even with a saved session', async (method,url) => {
 const res = await request(app)[method](url).set('Authorization','Bearer old-session');
 expect(res.status).toBe(404);
});
