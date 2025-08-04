import { supabase } from './supabase';

// Track whether the last token refresh attempt failed so we only sign out after
// consecutive failures. This allows the caller to retry once before the session
// is invalidated.
let refreshFailedOnce = false;

export async function fetchSubscriptionRole(
  backendUrl: string,
  query: string,
  headers: Record<string, string>,
  roles: string[]
): Promise<'ok' | 'unauthorized' | 'error'> {
  try {
    let resp = await fetch(
      `${backendUrl}/api/get-stream?endpoint=subscriptions&${query}`,
      { headers }
    );
    if (resp.status === 401) {
      const { token: newToken, error } = await refreshProviderToken();
      if (error || !newToken) {
        // Return an error to allow the caller to retry. Only sign out if the
        // previous refresh attempt also failed, indicating the session is
        // likely invalid.
        if (refreshFailedOnce) {
          await supabase.auth.signOut();
          storeProviderToken(undefined);
          refreshFailedOnce = false;
          if (typeof window !== 'undefined') {
            alert('Session expired. Please authorize again.');
          }
          return 'unauthorized';
        }
        refreshFailedOnce = true;
        return 'error';
      }
      refreshFailedOnce = false;
      headers.Authorization = `Bearer ${newToken}`;
      resp = await fetch(
        `${backendUrl}/api/get-stream?endpoint=subscriptions&${query}`,
        { headers }
      );
      if (resp.status === 401) {
        console.warn(
          'Subscription role check unauthorized – missing scope or not subscribed'
        );
        return 'unauthorized';
      }
    } else {
      // The request succeeded without needing a refresh, so clear any previous
      // failure state.
      refreshFailedOnce = false;
    }
    if (!resp.ok) {
      console.warn(
        `Subscription role check failed with status ${resp.status}`
      );
      return 'error';
    }
    const d = await resp.json();
    if (d.data && d.data.length > 0) {
      roles.push('Sub');
    }
    return 'ok';
  } catch (e) {
    console.error('Subscription role check failed', e);
    refreshFailedOnce = false;
    return 'error';
  }
}

const TOKEN_KEY = 'twitch_provider_token';

export function storeProviderToken(token: string | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors (e.g. server-side rendering or quota issues)
  }
}

export function getStoredProviderToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(TOKEN_KEY) || undefined;
  } catch {
    return undefined;
  }
}

// Force refresh the Supabase session to obtain a new Twitch provider token.
// When successful, the updated token is persisted using `storeProviderToken` so
// that subsequent requests can reuse it without another refresh.
export async function refreshProviderToken(): Promise<{
  token?: string;
  error: boolean;
  noRefreshToken?: boolean;
}> {
  try {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      storeProviderToken(undefined);
      return { error: true };
    }

    if (!sessionData.session.refresh_token) {
      storeProviderToken(undefined);
      return { error: true, noRefreshToken: true };
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Failed to refresh provider token', error);
      storeProviderToken(undefined);
      return { error: true };
    }
    const token = (data.session as any)?.provider_token as string | undefined;
    if (token) {
      storeProviderToken(token);
      console.log(`Provider token refreshed at ${new Date().toISOString()}`);
      return { token, error: false };
    }
    storeProviderToken(undefined);
    return { error: true };
  } catch (e) {
    console.error('Failed to refresh provider token', e);
    storeProviderToken(undefined);
    return { error: true };
  }
}

