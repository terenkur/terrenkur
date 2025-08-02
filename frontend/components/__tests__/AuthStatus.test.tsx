import { render, waitFor } from '@testing-library/react';

jest.mock('@/lib/supabase', () => {
  const session = {
    user: { id: '123', user_metadata: {} },
    provider_token: 'token123',
  };
  const from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session } }),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
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
  });

  it('skips role checks when scopes are missing', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url === 'https://id.twitch.tv/oauth2/validate') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ scope: ['user:read:email'] }),
        });
      }
      if (url === 'http://backend/api/get-stream?endpoint=users') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: '123', profile_image_url: 'img' }] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    render(<AuthStatus />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://backend/api/get-stream?endpoint=users',
        expect.any(Object)
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://id.twitch.tv/oauth2/validate',
        expect.any(Object)
      );
    });

    expect(fetchMock.mock.calls.length).toBe(2);
    const urls = fetchMock.mock.calls.map((c: any) => c[0]);
    expect(urls.some((u: string) => u.includes('moderation/moderators'))).toBe(false);
    expect(urls.some((u: string) => u.includes('channels/vips'))).toBe(false);
    expect(fetchSubscriptionRole).not.toHaveBeenCalled();
  });
});
