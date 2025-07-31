export async function fetchSubscriptionRole(
  backendUrl: string,
  query: string,
  headers: Record<string, string>,
  roles: string[]
) {
  try {
    const resp = await fetch(
      `${backendUrl}/api/get-stream?endpoint=subscriptions&${query}`,
      { headers }
    );
    if (!resp.ok) return; // likely missing scope or not subscribed
    const d = await resp.json();
    if (d.data && d.data.length > 0) {
      const info = d.data[0] || {};
      const monthsRaw = info.cumulative_months ?? info.cumulativeMonths;
      const months = Number(monthsRaw);
      if (Number.isFinite(months)) {
        roles.push(`Sub ${months}`);
      } else {
        roles.push('Sub');
      }
    }
  } catch {
    // ignore errors
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

