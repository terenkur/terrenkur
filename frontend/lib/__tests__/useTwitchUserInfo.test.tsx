import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useTwitchUserInfo } from '../useTwitchUserInfo';

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
