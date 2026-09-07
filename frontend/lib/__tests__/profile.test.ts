import { fetchMyProfile, fetchMyVotes } from '../profile';
const session = { access_token: 'fixture-session', user: { id: 'auth1' } } as any;
beforeEach(() => { process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend'; });
it('reads a profile through an authorized backend request', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: 1 } }) });
  expect((await fetchMyProfile(session)).data).toEqual({ id: 1 });
  expect(global.fetch).toHaveBeenCalledWith('https://backend/api/me', expect.objectContaining({ headers: { Authorization: 'Bearer fixture-session' }, cache: 'no-store' }));
});
it('links a first-time verified profile before retrying its read', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: null }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 2 } }) });
  expect((await fetchMyProfile(session)).data).toEqual({ id: 2 });
  expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://backend/api/ensure-twitch-login', expect.objectContaining({ method: 'POST' }));
});
it('does not hide an authorization error as a successful empty profile', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  const result = await fetchMyProfile(session);
  expect(result.data).toBeNull(); expect(result.error).toBeInstanceOf(Error);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('requests votes without accepting a client-selected owner', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ votes: [{ slot: 1 }] }) });
  expect(await fetchMyVotes(session, 5)).toEqual([{ slot: 1 }]);
  expect(global.fetch).toHaveBeenCalledWith('https://backend/api/my-votes?poll_id=5', expect.objectContaining({ headers: { Authorization: 'Bearer fixture-session' } }));
});
