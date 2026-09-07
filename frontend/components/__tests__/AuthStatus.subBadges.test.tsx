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
        'roles.Sub': 'Sub',
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

it.each([[1,'1'],[2,'2'],[3,'3'],[6,'6'],[9,'9'],[12,'12'],[18,'18'],[24,'24']])('renders subscription badge for %i months', async (months, badge) => {
  (fetchMyProfile as jest.Mock).mockResolvedValue({ data: { id: 1, total_months_subbed: months }, error: null });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ roles: { testuser: { roles: ['Sub'], profileImageUrl: null } } }) });
  render(<AuthStatus />);
  expect(await screen.findByAltText('Sub')).toHaveAttribute('src', '/icons/subs/' + badge + '.svg');
});
