import { render, waitFor, screen, cleanup } from '@testing-library/react';

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

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('AuthStatus sub badges', () => {
  const backendUrl = 'https://backend';
  const channelId = 'chan123';
  let originalFetch: any;
  let fromReturn: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'true';
    process.env.NEXT_PUBLIC_BACKEND_URL = backendUrl;
    process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID = channelId;
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });
    fromReturn = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };
    (supabase.from as jest.Mock).mockReturnValue(fromReturn);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    [1, '1'],
    [2, '2'],
    [4, '3'],
    [7, '6'],
    [10, '9'],
    [15, '12'],
    [20, '18'],
    [30, '24'],
  ])('renders %s.svg for %d months', async (months, badge) => {
    fromReturn.maybeSingle.mockResolvedValue({
      data: { id: 42, total_months_subbed: months },
    });
    const userId = 'user1';
    const fetchMock = jest.fn(async (url: RequestInfo) => {
      if (url === `${backendUrl}/api/get-stream?endpoint=users`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: userId, profile_image_url: '/p.png' }] }),
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
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
      if (
        url ===
        `${backendUrl}/api/get-stream?endpoint=channels/vips&broadcaster_id=${channelId}&user_id=${userId}`
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
      if (
        url ===
        `${backendUrl}/api/get-stream?endpoint=subscriptions&broadcaster_id=${channelId}&user_id=${userId}`
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{}] }),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as any;

    render(<AuthStatus />);

    const img = await screen.findByAltText('Sub');
    expect(img.getAttribute('src')).toContain(`/icons/subs/${badge}.svg`);
  });

  it('does not render badge for 0 months', async () => {
    fromReturn.maybeSingle.mockResolvedValue({
      data: { id: 42, total_months_subbed: 0 },
    });
    const userId = 'user1';
    const fetchMock = jest.fn(async (url: RequestInfo) => {
      if (url === `${backendUrl}/api/get-stream?endpoint=users`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: userId, profile_image_url: '/p.png' }] }),
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
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
      if (
        url ===
        `${backendUrl}/api/get-stream?endpoint=channels/vips&broadcaster_id=${channelId}&user_id=${userId}`
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
      if (
        url ===
        `${backendUrl}/api/get-stream?endpoint=subscriptions&broadcaster_id=${channelId}&user_id=${userId}`
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as any;

    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.queryByAltText('Sub')).toBeNull();
    });
  });
});

