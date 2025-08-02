import { supabase } from './supabase';

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
      const newToken = await refreshProviderToken();
      if (!newToken) {
        await supabase.auth.signOut();
        storeProviderToken(undefined);
        return 'unauthorized';
      }
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
export async function refreshProviderToken(): Promise<string | undefined> {
  try {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      storeProviderToken(undefined);
      return undefined;
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    const token = (data.session as any)?.provider_token as string | undefined;
    if (token) {
      storeProviderToken(token);
    }
    return token;
  } catch (e) {
    console.error('Failed to refresh provider token', e);
    return undefined;
  }
}

