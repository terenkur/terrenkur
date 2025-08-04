import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';

const mockSession = {
  user: { id: '123', user_metadata: { name: 'TestUser' } },
  provider_token: 'token123',
};
let authStateChangeCb: any;

jest.mock('@/lib/supabase', () => {
  const from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest.fn((cb) => {
          authStateChangeCb = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
        signOut: jest.fn().mockResolvedValue({}),
      },
      from,
    },
  };
});

jest.mock('@/lib/twitch', () => ({
  getStoredProviderToken: jest.fn(),
  storeProviderToken: jest.fn(),
  refreshProviderToken: jest.fn(),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <div onClick={onSelect}>{children}</div>
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import AuthStatus from '../AuthStatus';
import { supabase } from '@/lib/supabase';

describe('AuthStatus login/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'false';
    authStateChangeCb = null;
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
  });

  it('allows user to initiate login', async () => {
    jest.useFakeTimers();
    render(<AuthStatus />);

    const btn = await screen.findByText('Login with Twitch');
    fireEvent.click(btn);
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    });
    expect(supabase.auth.signInWithOAuth.mock.calls[0][0]).toMatchObject({
      provider: 'twitch',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'user:read:email',
      },
    });
    jest.useRealTimers();
  });

  it('allows user to logout', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });

    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByText('Log out')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Log out'));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AuthStatus roles', () => {
  const backendUrl = 'https://backend';
  const channelId = 'chan123';
  let originalFetch: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'true';
    process.env.NEXT_PUBLIC_BACKEND_URL = backendUrl;
    process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID = channelId;
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('computes roles using streamer token', async () => {
    const userId = 'user1';
    const fetchMock = jest.fn(async (url: RequestInfo, options?: RequestInit) => {
      if (url === `${backendUrl}/api/get-stream?endpoint=users`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: userId, profile_image_url: 'p.png' }],
          }),
        } as Response;
      }
      if (url === `${backendUrl}/api/streamer-token`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: 'st123' }),
        } as Response;
      }
      if (
        url ===
        `${backendUrl}/api/get-stream?endpoint=moderation/moderators&broadcaster_id=${channelId}&user_id=${userId}`
      ) {
        expect(options?.headers).toMatchObject({
          Authorization: 'Bearer st123',
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{}] }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response;
    });
    global.fetch = fetchMock as any;

    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByAltText('Mod')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${backendUrl}/api/streamer-token`
    );
  });

  it('skips repeated streamer-token fetch after 404', async () => {
    const userId = 'user1';
    const fetchMock = jest.fn(async (url: RequestInfo) => {
      if (url === `${backendUrl}/api/get-stream?endpoint=users`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: userId, profile_image_url: 'p.png' }] }),
        } as Response;
      }
      if (url === `${backendUrl}/api/streamer-token`) {
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as any;

    render(<AuthStatus />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const stCalls = fetchMock.mock.calls.filter(
      ([url]) => url === `${backendUrl}/api/streamer-token`
    );
    expect(stCalls).toHaveLength(1);
  });

  it('uses session token for role checks when streamer has scopes', async () => {
    const userId = channelId;
    const fetchMock = jest.fn(
      async (url: RequestInfo, options?: RequestInit) => {
        if (url === `${backendUrl}/api/get-stream?endpoint=users`) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: userId, profile_image_url: 'p.png' }],
            }),
          } as Response;
        }
        if (url === `${backendUrl}/api/streamer-token`) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ token: 'st123' }),
          } as Response;
        }
        if (url === 'https://id.twitch.tv/oauth2/validate') {
          expect(options?.headers).toMatchObject({
            Authorization: 'Bearer token123',
          });
          return {
            ok: true,
            status: 200,
            json: async () => ({
              scopes: [
                'moderation:read',
                'channel:read:vips',
                'channel:read:subscriptions',
              ],
            }),
          } as Response;
        }
        if (
          url ===
          `${backendUrl}/api/get-stream?endpoint=moderation/moderators&broadcaster_id=${channelId}&user_id=${userId}`
        ) {
          expect(options?.headers).toMatchObject({
            Authorization: 'Bearer token123',
          });
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{}] }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
    );
    global.fetch = fetchMock as any;

    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByAltText('Mod')).toBeInTheDocument();
    });
    const modCall = fetchMock.mock.calls.find(([url]) =>
      url.toString().includes('moderation/moderators')
    );
    expect(modCall?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer token123' },
    });
  });
});

