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

