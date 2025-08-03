import { render, waitFor, act, screen } from '@testing-library/react';

const mockSession = {
  user: { id: '123', user_metadata: {} },
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
        getSession: jest
          .fn()
          .mockResolvedValue({ data: { session: mockSession } }),
        onAuthStateChange: jest.fn((cb) => {
          authStateChangeCb = cb;
          return {
            data: { subscription: { unsubscribe: jest.fn() } },
          };
        }),
        signOut: jest.fn(),
      },
      from,
    },
  };
});

import { fetchSubscriptionRole } from '@/lib/twitch';
jest.mock('@/lib/twitch', () => ({
  fetchSubscriptionRole: jest.fn().mockResolvedValue('ok'),
  getStoredProviderToken: jest.fn(),
  storeProviderToken: jest.fn(),
  refreshProviderToken: jest.fn().mockResolvedValue({ token: 'token123', error: false }),
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

describe('AuthStatus role checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';
    process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID = '123';
    authStateChangeCb = null;
    mockSession.user.id = '123';
  });

  // tests will be added below

  it('checks roles for non-streamer user using streamer token', async () => {
    mockSession.user.id = '456';
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url === 'http://backend/api/get-stream?endpoint=users') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: '456', profile_image_url: 'img' }] }),
        });
      }
      if (url === 'http://backend/api/streamer-token') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ token: 'streamer' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    render(<AuthStatus />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://backend/api/get-stream?endpoint=users',
        expect.any(Object)
      );
      expect(
        fetchMock.mock.calls.some((c) => c[0] === 'http://backend/api/streamer-token')
      ).toBe(true);
    });

    expect(fetchSubscriptionRole).not.toHaveBeenCalled();
    expect(screen.queryByText(/Missing Twitch scopes/)).toBeNull();
  });

  it('handles streamer user', async () => {
    mockSession.user.id = '123';
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url === 'http://backend/api/get-stream?endpoint=users') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: '123', profile_image_url: 'img' }] }),
        });
      }
      if (url === 'http://backend/api/streamer-token') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ token: 'streamer' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    render(<AuthStatus />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://backend/api/get-stream?endpoint=users',
        expect.any(Object)
      );
    });

    expect(screen.getByText('Streamer login')).toBeInTheDocument();
    expect(screen.queryByText(/Missing Twitch scopes/)).toBeNull();
  });

  it('falls back to viewer token when streamer token missing', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url === 'http://backend/api/get-stream?endpoint=users') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: '123', profile_image_url: 'img' }] }),
        });
      }
      if (url === 'http://backend/api/streamer-token') {
        return Promise.resolve({ ok: false, status: 404 });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(<AuthStatus />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((c) => c[0] === 'http://backend/api/streamer-token')
      ).toBe(true);
    });

    expect(fetchSubscriptionRole).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Missing Twitch scopes'));
    warnSpy.mockRestore();
  });
});
