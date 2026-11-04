const { createSecurity, isModeratorFromAuth, requireAdminToken } = require('../security');
const response = () => ({ status: jest.fn(function () { return this; }), json: jest.fn(), set: jest.fn() });
it.each([
 { app_metadata: { provider: 'twitch', site_moderator: true } },
 { app_metadata: { provider: 'email', is_moderator: true, role: 'moderator' } },
 { app_metadata: { provider: 'email', site_moderator: 'true' } },
 { app_metadata: { provider: 'email' }, user_metadata: { site_moderator: true } },
])('rejects old, unapproved or user-editable moderator claims', user => {
 expect(isModeratorFromAuth(user)).toBe(false);
});
it('accepts a provisioned email moderator', () => {
 expect(isModeratorFromAuth({app_metadata:{provider:'email',site_moderator:true}})).toBe(true);
});
it.each([undefined, '', 'wrong'])('rejects invalid administrator credentials: %s', value => {
 process.env.ADMIN_TOKEN='fixture-admin';
 const res=response(),next=jest.fn();
 requireAdminToken({headers:{'x-admin-token':value}},res,next);
 expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
});
it('fails closed when ADMIN_TOKEN is missing', () => {
 delete process.env.ADMIN_TOKEN;
 const res=response(),next=jest.fn(); requireAdminToken({headers:{}},res,next);
 expect(res.status).toHaveBeenCalledWith(403);
});
it('allows the configured admin token', () => {
 process.env.ADMIN_TOKEN='fixture-admin'; const next=jest.fn();
 requireAdminToken({headers:{'x-admin-token':'fixture-admin'}},response(),next);
 expect(next).toHaveBeenCalledTimes(1);
});
it('rechecks current staff permissions after revocation', async () => {
 const user={app_metadata:{provider:'email',site_moderator:true}};
 const getUser=jest.fn(async()=>({data:{user}})); const db={auth:{getUser},from:jest.fn()};
 const gate=createSecurity(db).requireModerator, next=jest.fn();
 await gate({headers:{authorization:'Bearer valid'}},response(),next);
 expect(next).toHaveBeenCalledTimes(1);
 user.app_metadata.site_moderator=false;
 const res=response(); await gate({headers:{authorization:'Bearer valid'}},res,next);
 expect(res.status).toHaveBeenCalledWith(403); expect(next).toHaveBeenCalledTimes(1);
 expect(db.from).not.toHaveBeenCalled();
});
it('does not accept URL tokens', async () => {
 const getUser=jest.fn(),res=response();
 await createSecurity({auth:{getUser}}).requireModerator({headers:{},query:{access_token:'secret'}},res,jest.fn());
 expect(res.status).toHaveBeenCalledWith(401); expect(getUser).not.toHaveBeenCalled();
});
it('fails closed on an auth service outage',async()=>{
 const res=response(); const getUser=jest.fn().mockRejectedValue(new Error('offline'));
 await createSecurity({auth:{getUser}}).requireModerator({headers:{authorization:'Bearer valid'}},res,jest.fn());
 expect(res.status).toHaveBeenCalledWith(503);
});

describe('dedicated music player token', () => {
 const token = 'ab'.repeat(32);
 const savedToken = process.env.MUSIC_QUEUE_PLAYER_TOKEN;
 afterEach(() => {
  if (savedToken === undefined) delete process.env.MUSIC_QUEUE_PLAYER_TOKEN;
  else process.env.MUSIC_QUEUE_PLAYER_TOKEN = savedToken;
 });
 it('allows only a valid dedicated token without calling Supabase auth', async () => {
  process.env.MUSIC_QUEUE_PLAYER_TOKEN = token;
  const getUser = jest.fn(), next = jest.fn(), req = { headers: { 'x-music-player-token': token } };
  await createSecurity({ auth: { getUser } }).requireMusicPlayer(req, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.musicPlayerAccess).toBe(true);
  expect(getUser).not.toHaveBeenCalled();
 });
 it.each([undefined, '', 'short', 'cd'.repeat(32)])('rejects missing, weak or rotated configuration: %s', async configured => {
  if (configured === undefined) delete process.env.MUSIC_QUEUE_PLAYER_TOKEN;
  else process.env.MUSIC_QUEUE_PLAYER_TOKEN = configured;
  const res = response(), next = jest.fn();
  await createSecurity({ auth: { getUser: jest.fn() } }).requireMusicPlayer({ headers: { 'x-music-player-token': token } }, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
 });
 it.each(['', 'wrong', ['ab'.repeat(32)], 'ab'.repeat(33)])('rejects malformed tokens', async actual => {
  process.env.MUSIC_QUEUE_PLAYER_TOKEN = token;
  const res = response(), next = jest.fn(), getUser = jest.fn();
  await createSecurity({ auth: { getUser } }).requireMusicPlayer({ headers: { 'x-music-player-token': actual, authorization: 'Bearer other' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
  expect(getUser).not.toHaveBeenCalled();
 });
});
