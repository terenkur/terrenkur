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
