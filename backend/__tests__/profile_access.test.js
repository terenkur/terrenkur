const request=require('supertest');
process.env.SUPABASE_URL='http://localhost'; process.env.SUPABASE_KEY='fixture';
const mockGetUser=jest.fn(); const mockFrom=jest.fn();
jest.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:mockGetUser},from:mockFrom})}));
const app=require('../server');
beforeEach(()=>{jest.clearAllMocks();mockGetUser.mockResolvedValue({data:{user:{id:'staff',app_metadata:{provider:'email',site_moderator:true}}}});});
it.each(['/api/me','/api/twitch-rewards','/api/obs-media'])('rejects anonymous access to %s',async url=>{
 expect((await request(app).get(url)).status).toBe(401); expect(mockFrom).not.toHaveBeenCalled();
});
it('returns staff access without creating a participant profile',async()=>{
 const res=await request(app).get('/api/me').set('Authorization','Bearer fixture');
 expect(res.status).toBe(200);expect(res.body.user).toMatchObject({auth_id:'staff',is_moderator:true});
 expect(res.headers['cache-control']).toBe('no-store');expect(mockFrom).not.toHaveBeenCalled();
});
it.each(['/api/me','/api/twitch-rewards','/api/obs-media'])('rejects an old channel moderator on %s',async url=>{
 mockGetUser.mockResolvedValue({data:{user:{id:'old',app_metadata:{provider:'twitch',role:'moderator'},user_metadata:{site_moderator:true}}}});
 expect((await request(app).get(url).set('Authorization','Bearer old')).status).toBe(403);
 expect(mockFrom).not.toHaveBeenCalled();
});
it('protects playback mutation',async()=>{expect((await request(app).post('/api/music-queue/1/start')).status).toBe(401);});
it('has a health endpoint',async()=>{expect((await request(app).get('/healthz')).body).toEqual({status:'ok'});});
