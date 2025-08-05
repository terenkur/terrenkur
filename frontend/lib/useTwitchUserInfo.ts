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
  const [error, setError] = useState<string | null>(null);

  const enableRoles = process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const login = twitchLogin?.toLowerCase();
    if (!login) {
      setProfileUrl(null);
      setRoles([]);
      setError(null);
      return;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    const token = session
      ? ((session as any)?.provider_token as string | undefined) ||
        getStoredProviderToken()
      : undefined;
    if (!session) {
      storeProviderToken(undefined);
    }
    if (!backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      setError("Backend URL not configured.");
      return;
    }

    // Fallback using a preconfigured streamer token
    const fetchStreamerInfo = async () => {
      try {
        const getToken = async () => {
          const tokenRes = await fetch(`${backendUrl}/api/streamer-token`);
          if (!tokenRes.ok) throw new Error("Failed to fetch streamer token.");
          const { token: streamerToken } = (await tokenRes.json()) as {
            token?: string;
          };
          if (!streamerToken) throw new Error("Failed to fetch streamer token.");
          return streamerToken;
        };

        let streamerToken = await getToken();
        const sHeaders = { Authorization: `Bearer ${streamerToken}` };
        let refreshPromise: Promise<string | undefined> | null = null;

        const refreshToken = async () => {
          const resp = await fetch(`${backendUrl}/refresh-token`);
          if (!resp.ok) return undefined;
          try {
            return await getToken();
          } catch {
            return undefined;
          }
        };

        const fetchStream = async (url: string) => {
          let resp = await fetch(url, { headers: sHeaders });
          if (resp.status === 401) {
            if (!refreshPromise) {
              refreshPromise = refreshToken();
            }
            const newToken = await refreshPromise;
            if (!newToken) {
              throw new Error("Failed to refresh streamer token.");
            }
            sHeaders.Authorization = `Bearer ${newToken}`;
            resp = await fetch(url, { headers: sHeaders });
            if (resp.status === 401) {
              throw new Error("Streamer token unauthorized after refresh.");
            }
          }
          return resp;
        };

        const userResp = await fetchStream(
          `${backendUrl}/api/get-stream?endpoint=users&login=${login}`
        );
        if (!userResp.ok) throw new Error("Failed to fetch Twitch user.");
        const uData = await userResp.json();
        const me = uData.data?.[0];
        if (!me) throw new Error("Failed to fetch Twitch user.");
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
              const resp = await fetchStream(
                `${backendUrl}/api/get-stream?endpoint=${url}&${query}`
              );
              if (!resp.ok) return;
              const d = await resp.json();
              if (d.data && d.data.length > 0) r.push(name);
            } catch (err: any) {
              if (err?.status === 401 || err?.message?.includes("401")) {
                return;
              }
              throw err;
            }
          };
          if (uid === channelId) r.push("Streamer");
          await checkRole("moderation/moderators", "Mod");
          await checkRole("channels/vips", "VIP");
          await checkRole("subscriptions", "Sub");
        }
        setRoles(r);
      } catch (e) {
        console.error("Twitch API error", e);
        setProfileUrl(null);
        setRoles([]);
        setError(
          e instanceof Error ? e.message : "Failed to fetch Twitch info."
        );
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
        const { token: newToken, error, noRefreshToken } = await refreshProviderToken();
        if (error || !newToken) {
          if (noRefreshToken) {
            console.warn('No refresh token available; falling back to streamer info');
            await fetchStreamerInfo();
            return null;
          }
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
          `${backendUrl}/api/get-stream?endpoint=users&login=${login}`
        );
        if (!userRes) return; // fetchWithRefresh handled fallback
        if (!userRes.ok) throw new Error("user");
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
        if (!validateRes) return;
        if (!validateRes.ok) throw new Error("validate");
        const { scopes = [], user_id } = (await validateRes.json()) as {
          scopes?: string[];
          user_id?: string;
        };
        if (user_id && channelId && user_id !== channelId) {
          // Token does not belong to the configured channel; avoid unauthorized
          // viewer role checks by falling back to the dedicated streamer token.
          await fetchStreamerInfo();
          return;
        }
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
        setError("Failed to fetch Twitch info.");
        await fetchStreamerInfo();
      }
    };

    setError(null);
    fetchInfo();
  }, [twitchLogin, session, enableRoles]);

  return { profileUrl, roles, error };
}
