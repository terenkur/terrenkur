import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useTwitchUserInfo } from '../useTwitchUserInfo';
import { supabase } from '../supabase';
import { refreshProviderToken } from '../twitch';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('../twitch', () => ({
  fetchSubscriptionRole: jest.fn().mockResolvedValue('ok'),
  getStoredProviderToken: jest.fn().mockReturnValue(undefined),
  refreshProviderToken: jest.fn(),
  storeProviderToken: jest.fn(),
}));

describe('useTwitchUserInfo fallback', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';
    process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID = 'chan1';
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'true';
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'streamer123' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'chan1', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) });
  });

  test('loads avatar and roles for unauthenticated visitors', async () => {
    function Comp() {
      const { profileUrl, roles } = useTwitchUserInfo('foo');
      return (
        <>
          <div data-testid="profile">{profileUrl}</div>
          <div data-testid="roles">{roles.join(',')}</div>
        </>
      );
    }
    render(<Comp />);
    await waitFor(() =>
      expect(screen.getByTestId('profile').textContent).toBe('avatar.jpg')
    );
    await waitFor(() =>
      expect(screen.getByTestId('roles').textContent).toContain('Streamer')
    );
    expect(screen.getByTestId('roles').textContent).toContain('Sub');
  });

  test('uses lowercase login when fetching user info', async () => {
    function Comp() {
      useTwitchUserInfo('FoO');
      return null;
    }
    render(<Comp />);
    await waitFor(() =>
      expect((global as any).fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('login=foo'),
        expect.any(Object)
      )
    );
  });

  test('refreshes streamer token on 401', async () => {
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'false';
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'old' }) })
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'new' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'chan1', profile_image_url: 'avatar.jpg' }] }),
      });
    function Comp() {
      const { profileUrl } = useTwitchUserInfo('foo');
      return <div data-testid="profile">{profileUrl}</div>;
    }
    render(<Comp />);
    await waitFor(() =>
      expect(screen.getByTestId('profile').textContent).toBe('avatar.jpg')
    );
    expect((global as any).fetch).toHaveBeenNthCalledWith(3, 'http://backend/refresh-token');
  });
});

describe('useTwitchUserInfo with viewer token', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';
    process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID = 'chan1';
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'true';
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { provider_token: 'viewer' } },
      error: null,
    });
    (refreshProviderToken as jest.Mock).mockReset();
  });

  test('falls back to streamer token when user_id differs', async () => {
    (global as any).fetch = jest
      .fn()
      // Initial fallback without session
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'streamer123' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'chan1', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      // Viewer token path
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'user123', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scopes: [], user_id: 'user123' }),
      })
      // Fallback after mismatch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'streamer123' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'user123', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) });

    function Comp() {
      const { roles } = useTwitchUserInfo('foo');
      return <div data-testid="roles">{roles.join(',')}</div>;
    }

    render(<Comp />);
    await waitFor(() =>
      expect(screen.getByTestId('roles').textContent).toContain('Sub')
    );
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      8,
      'http://backend/api/streamer-token'
    );
  });

  test('aborts remaining role checks after 401 and falls back', async () => {
    (refreshProviderToken as jest.Mock).mockResolvedValue({
      token: 'newViewer',
      error: false,
    });

    (global as any).fetch = jest
      .fn()
      // Initial fallback without session
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'streamer123' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'chan1', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      // Viewer token path
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'chan1', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scopes: [
            'moderation:read',
            'channel:read:vips',
            'channel:read:subscriptions',
          ],
          user_id: 'chan1',
        }),
      })
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({ status: 401, ok: false })
      // Fallback after unauthorized
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'streamer123' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'chan1', profile_image_url: 'avatar.jpg' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{}] }) });

    function Comp() {
      const { roles } = useTwitchUserInfo('foo');
      return <div data-testid="roles">{roles.join(',')}</div>;
    }

    render(<Comp />);
    await waitFor(() =>
      expect(screen.getByTestId('roles').textContent).toContain('Sub')
    );
    expect(refreshProviderToken).toHaveBeenCalledTimes(1);
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      10,
      'http://backend/api/streamer-token'
    );
  });
});
