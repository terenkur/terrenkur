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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        loginWithTwitch: 'Login with Twitch',
        logout: 'Log out',
        twitchInfoFetchFailed: 'Twitch info fetch failed',
        streamerTokenFetchFailed: 'Streamer token fetch failed',
        'roles.Mod': 'Mod',
        'roles.Streamer': 'Streamer',
        profile: 'Profile',
      };
      return translations[key] ?? key;
    },
  }),
}));

import AuthStatus from '../AuthStatus';
import { supabase } from '@/lib/supabase';

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});


jest.mock('@/lib/profile', () => ({ fetchMyProfile: jest.fn() }));
import { fetchMyProfile } from '@/lib/profile';
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'true';
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend';
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });
  (fetchMyProfile as jest.Mock).mockResolvedValue({ data: { id: 1, total_months_subbed: 1 }, error: null });
});

it('loads roles without requesting a streamer token', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ roles: { testuser: { roles: ['Mod'], profileImageUrl: null } } }) });
  render(<AuthStatus />);
  expect(await screen.findByAltText('Mod')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('https://backend/api/twitch-roles?login=testuser', expect.any(Object));
  expect(await screen.findByText('Profile')).toHaveAttribute('href', '/users/1');
});
it('does not retry credential endpoints when role service is unavailable', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  render(<AuthStatus />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByLabelText('Login with Twitch')).toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect((global.fetch as jest.Mock).mock.calls.every(([url]) => !String(url).includes('token'))).toBe(true);
});
it('skips role lookups when the feature is disabled', async () => {
  process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'false';
  global.fetch = jest.fn();
  render(<AuthStatus />);
  await screen.findByText('TestUser');
  expect(global.fetch).not.toHaveBeenCalled();
});
