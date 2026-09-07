export type TwitchInfo = { roles: string[]; profileImageUrl: string | null };

export async function fetchTwitchRoles(login: string, signal?: AbortSignal): Promise<TwitchInfo> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) throw new Error('Backend URL is missing');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${backend}/api/twitch-roles?login=${encodeURIComponent(login.toLowerCase())}`, {
      signal: signal || controller.signal,
    });
    if (!resp.ok) throw new Error(`Twitch roles unavailable (${resp.status})`);
    const info = (await resp.json()).roles?.[login.toLowerCase()];
    if (!info) throw new Error('Twitch user not found');
    return info;
  } finally { clearTimeout(timeout); }
}
