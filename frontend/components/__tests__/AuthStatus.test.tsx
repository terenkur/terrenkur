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

