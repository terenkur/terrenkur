import { fetchWithTimeout } from "./fetchWithTimeout";
export type TwitchInfo = { roles: string[]; profileImageUrl: string | null };

export async function fetchTwitchRoles(login: string, signal?: AbortSignal): Promise<TwitchInfo> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) throw new Error('Backend URL is missing');
    const resp = await fetchWithTimeout(`${backend}/api/twitch-roles?login=${encodeURIComponent(login.toLowerCase())}`, {
      signal,
    }, 15000, false);
    if (!resp.ok) throw new Error(`Twitch roles unavailable (${resp.status})`);
    const info = (await resp.json()).roles?.[login.toLowerCase()];
    if (!info) throw new Error('Twitch user not found');
    return info;
}
