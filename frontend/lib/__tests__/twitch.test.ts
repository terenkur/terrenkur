// Mock Supabase client with failing refresh behavior
const signOut = jest.fn();
const getSession = jest
  .fn()
  .mockResolvedValue({ data: { session: {} }, error: null });
const refreshSession = jest
  .fn()
  .mockResolvedValue({ data: {}, error: new Error('fail') });

jest.mock('../supabase', () => ({
  supabase: {
    auth: { signOut, getSession, refreshSession },
  },
}));

// Provide a mock alert implementation for environments like JSDOM
(global as any).alert = jest.fn();

describe('fetchSubscriptionRole', () => {
  const backendUrl = 'http://backend';
  const query = 'q';

  beforeEach(() => {
    jest.resetModules();
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue({ status: 401, ok: false } as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns error without signing out on first refresh failure', async () => {
    const twitch = await import('../twitch');
    const result = await twitch.fetchSubscriptionRole(
      backendUrl,
      query,
      {},
      []
    );
    const { supabase } = await import('../supabase');
    expect(result).toBe('error');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  test('signs out after consecutive refresh failures', async () => {
    const twitch = await import('../twitch');
    const { supabase } = await import('../supabase');

    const res1 = await twitch.fetchSubscriptionRole(
      backendUrl,
      query,
      {},
      []
    );
    expect(res1).toBe('error');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();

    const res2 = await twitch.fetchSubscriptionRole(
      backendUrl,
      query,
      {},
      []
    );
    expect(res2).toBe('unauthorized');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});

