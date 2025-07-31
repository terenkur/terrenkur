import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { fetchSubscriptionRole, getStoredProviderToken } from "./twitch";

export function useTwitchUserInfo(authId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authId) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }
    const token = (session as any)?.provider_token as string | undefined || getStoredProviderToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!token || !backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` } as Record<string, string>;

    const fetchInfo = async () => {
      try {
        const userRes = await fetch(
          `${backendUrl}/api/get-stream?endpoint=users&id=${authId}`,
          { headers }
        );
        if (!userRes.ok) throw new Error("user");
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error("user");
        setProfileUrl(me.profile_image_url);
        const uid = me.id as string;

        const r: string[] = [];
        if (channelId && uid === channelId) r.push("Streamer");

        const query = `broadcaster_id=${channelId}&user_id=${uid}`;
        const checkRole = async (url: string, name: string) => {
          try {
            const resp = await fetch(
              `${backendUrl}/api/get-stream?endpoint=${url}&${query}`,
              { headers }
            );
            if (!resp.ok) return;
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push(name);
          } catch {
            // ignore
          }
        };

        if (channelId) {
          await checkRole("moderation/moderators", "Mod");
          await checkRole("channels/vips", "VIP");
          await fetchSubscriptionRole(backendUrl, query, headers, r);
        }

        setRoles(r);
      } catch (e) {
        console.error("Twitch API error", e);
        setProfileUrl(null);
        setRoles([]);
      }
    };

    fetchInfo();
  }, [authId, session]);

  return { profileUrl, roles };
}
