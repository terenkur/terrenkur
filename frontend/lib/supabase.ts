import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. See frontend/.env.example'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
});

// Global auth listener to handle token refresh failures
export const authListener = supabase.auth.onAuthStateChange(
  async (event, session) => {
    if ((event as string) === 'TOKEN_REFRESH_FAILED') {
      await supabase.auth.signOut();
      try {
        localStorage.removeItem('twitch_provider_token');
      } catch {
        // ignore storage errors (e.g. server-side rendering)
      }
    } else if (
      session &&
      ((event as string) === 'SIGNED_IN' || (event as string) === 'TOKEN_REFRESHED')
    ) {
      try {
        await fetch('/api/ensure-twitch-login', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch {
        // Ignore network errors
      }
    }
  }
);
