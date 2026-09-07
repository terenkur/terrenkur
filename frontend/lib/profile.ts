import type { Session } from '@supabase/supabase-js';

export type Profile = {
  id: number; username: string; auth_id: string; twitch_login: string | null;
  vote_limit: number; is_moderator: boolean; total_months_subbed: number;
};
export type MyVote = { game_id: number; user_id: number; slot: number };

async function api(path: string, session: Session, method = 'GET') {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) throw new Error('Backend URL is missing');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${backend}${path}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function fetchMyProfile(session: Session): Promise<{ data: Profile | null; error: Error | null }> {
  try {
    let payload = await api('/api/me', session);
    if (!payload.user) {
      await api('/api/ensure-twitch-login', session, 'POST');
      payload = await api('/api/me', session);
    }
    return { data: payload.user, error: null };
  } catch (error) {
    console.error('Failed to load profile', error);
    return { data: null, error: error instanceof Error ? error : new Error('Profile unavailable') };
  }
}

export async function fetchMyVotes(session: Session, pollId: number): Promise<MyVote[]> {
  return (await api(`/api/my-votes?poll_id=${encodeURIComponent(pollId)}`, session)).votes;
}
