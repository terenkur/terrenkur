import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  fetchSubscriptionRole,
  getStoredProviderToken,
  refreshProviderToken,
  storeProviderToken,
} from "./twitch";

export function useTwitchUserInfo(twitchLogin: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const enableRoles = process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!twitchLogin) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    const token = (session as any)?.provider_token as string | undefined ||
      getStoredProviderToken();
    if (!backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }

    // Fallback using a preconfigured streamer token
    const fetchStreamerInfo = async () => {
      try {
        const tokenRes = await fetch(`${backendUrl}/api/streamer-token`);
        if (!tokenRes.ok) throw new Error("token");
        const { token: streamerToken } = (await tokenRes.json()) as {
          token?: string;
        };
        if (!streamerToken) throw new Error("token");
        const sHeaders = { Authorization: `Bearer ${streamerToken}` };
        const userResp = await fetch(
          `${backendUrl}/api/get-stream?endpoint=users&login=${twitchLogin}`,
          { headers: sHeaders }
        );
        if (!userResp.ok) throw new Error("user");
        const uData = await userResp.json();
        const me = uData.data?.[0];
        if (!me) throw new Error("user");
        setProfileUrl(me.profile_image_url);
        if (!enableRoles) {
          setRoles([]);
          return;
        }
        const uid = me.id as string;
        const r: string[] = [];
        if (channelId) {
          const query = `broadcaster_id=${channelId}&user_id=${uid}`;
          const checkRole = async (url: string, name: string) => {
            try {
              const resp = await fetch(
                `${backendUrl}/api/get-stream?endpoint=${url}&${query}`,
                { headers: sHeaders }
              );
              if (!resp.ok) return;
              const d = await resp.json();
              if (d.data && d.data.length > 0) r.push(name);
            } catch {
              // ignore
            }
          };
          if (uid === channelId) r.push("Streamer");
          await checkRole("moderation/moderators", "Mod");
          await checkRole("channels/vips", "VIP");
          await fetchSubscriptionRole(backendUrl, query, sHeaders, r);
        }
        setRoles(r);
      } catch (e) {
        console.error("Twitch API error", e);
        setProfileUrl(null);
        setRoles([]);
      }
    };

    if (!token) {
      fetchStreamerInfo();
      return;
    }

    const headers = { Authorization: `Bearer ${token}` } as Record<string, string>;

    // Helper to fetch Twitch endpoints with automatic token refresh on 401
    const fetchWithRefresh = async (url: string) => {
      let resp = await fetch(url, { headers });
      if (resp.status === 401) {
        const { token: newToken, error } = await refreshProviderToken();
        if (error || !newToken) {
          await supabase.auth.signOut();
          storeProviderToken(undefined);
          if (typeof window !== 'undefined') {
            alert('Session expired. Please authorize again.');
          }
          return null;
        }
        headers.Authorization = `Bearer ${newToken}`;
        resp = await fetch(url, { headers });
      }
      return resp;
    };

    const fetchInfo = async () => {
      try {
        const userRes = await fetchWithRefresh(
          `${backendUrl}/api/get-stream?endpoint=users&login=${twitchLogin}`
        );
        if (!userRes || !userRes.ok) throw new Error("user");
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error("user");
        setProfileUrl(me.profile_image_url);

        if (!enableRoles) {
          setRoles([]);
          return;
        }

        const validateRes = await fetchWithRefresh(
          "https://id.twitch.tv/oauth2/validate"
        );
        if (!validateRes || !validateRes.ok) throw new Error("validate");
        const { scopes = [] } = (await validateRes.json()) as { scopes?: string[] };
        const hasScope = (s: string) => scopes.includes(s);
        const requiredScopes = [
          "moderation:read",
          "channel:read:vips",
          "channel:read:subscriptions",
        ];
        const missingScopes = requiredScopes.some((s) => !hasScope(s));
        if (missingScopes) {
          await fetchStreamerInfo();
          return;
        }

        const uid = me.id as string;
        const r: string[] = [];

        if (channelId) {
          const query = `broadcaster_id=${channelId}&user_id=${uid}`;
          const checkRole = async (url: string, name: string) => {
            try {
              const resp = await fetchWithRefresh(
                `${backendUrl}/api/get-stream?endpoint=${url}&${query}`
              );
              if (!resp || !resp.ok) return;
              const d = await resp.json();
              if (d.data && d.data.length > 0) r.push(name);
            } catch {
              // ignore
            }
          };

          if (uid === channelId) {
            r.push("Streamer");
          }
          if (hasScope("moderation:read")) {
            await checkRole("moderation/moderators", "Mod");
          }
          if (hasScope("channel:read:vips")) {
            await checkRole("channels/vips", "VIP");
          }
          if (hasScope("channel:read:subscriptions")) {
            await fetchSubscriptionRole(backendUrl, query, headers, r);
          }
        }

        setRoles(r);
      } catch (e) {
        console.error("Twitch API error", e);
        await fetchStreamerInfo();
      }
    };

    fetchInfo();
  }, [twitchLogin, session, enableRoles]);

  return { profileUrl, roles };
}
