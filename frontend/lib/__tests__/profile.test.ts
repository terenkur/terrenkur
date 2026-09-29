import { fetchMyProfile } from '../profile';
const session = { access_token: 'fixture-session', user: { id: 'auth1' } } as any;
beforeEach(() => { process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend'; });
it('reads a profile through an authorized backend request', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: 1 } }) });
  expect((await fetchMyProfile(session)).data).toEqual({ id: 1 });
  expect(global.fetch).toHaveBeenCalledWith('https://backend/api/me', expect.objectContaining({ headers: { Authorization: 'Bearer fixture-session' }, cache: 'no-store' }));
});
it('does not link an absent staff profile to a channel participant', async () => {
 global.fetch = jest.fn().mockResolvedValue({ok:true,json:async()=>({user:null})});
 expect((await fetchMyProfile(session)).data).toBeNull(); expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('does not hide an authorization error as a successful empty profile', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  const result = await fetchMyProfile(session);
  expect(result.data).toBeNull(); expect(result.error).toBeInstanceOf(Error);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
