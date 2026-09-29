import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase configuration is missing');

// Separate staff sessions from any previously stored visitor credentials.
if (typeof window !== 'undefined') {
  try {
    const oldKey = 'sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token';
    [oldKey, oldKey + '-code-verifier', 'twitch_provider_token'].forEach(key => localStorage.removeItem(key));
  } catch { /* Storage may be disabled. */ }
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'terrenkur-moderator-session', detectSessionInUrl: false },
});
