jest.mock('../supabase', () => ({ supabase: { auth: {} } }));
import { fetchSubscriptionRole } from '../twitch';

describe('fetchSubscriptionRole', () => {
  const backendUrl = 'http://backend';
  const query = 'q';

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('adds Sub role when subscription exists', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'st' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) });
    const roles: string[] = [];
    const res = await fetchSubscriptionRole(backendUrl, query, roles);
    expect(res).toBe('ok');
    expect(roles).toContain('Sub');
  });

  test('returns unauthorized on 401', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'st' }) })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    const res = await fetchSubscriptionRole(backendUrl, query, []);
    expect(res).toBe('unauthorized');
  });

  test('returns error when token fetch fails', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const res = await fetchSubscriptionRole(backendUrl, query, []);
    expect(res).toBe('error');
  });
});
