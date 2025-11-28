import { useEffect, useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useTranslation } from "react-i18next";
import {
  fetchSubscriptionRole,
  getStoredProviderToken,
  refreshProviderToken,
  storeProviderToken,
} from "./twitch";
import { notifySessionExpired } from "./sessionExpired";

export function useTwitchUserInfo(twitchLogin: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const enableRoles = process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";
  const prevSessionRef = useRef<Session | null>(null);
  const isFallbackTriggered = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    isFallbackTriggered.current = false;
    const login = twitchLogin?.toLowerCase();
    if (!login) {
      setProfileUrl(null);
      setRoles([]);
      setError(null);
      return;
    }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
      const prevSession = prevSessionRef.current;

      const REQUEST_TIMEOUT = 10000;

      const fetchWithTimeout = async (
        input: RequestInfo,
        init: RequestInit = {},
        timeout = REQUEST_TIMEOUT
      ) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          return await fetch(input, { ...init, signal: controller.signal });
        } finally {
          clearTimeout(id);
        }
      };
    let token: string | undefined;
    if (!session) {
      if (prevSession) {
        storeProviderToken(undefined);
      }
    } else {
      token =
        ((session as any)?.provider_token as string | undefined) ||
        getStoredProviderToken();
      const providerToken = (session as any)?.provider_token as string | undefined;
      if (providerToken) {
        storeProviderToken(providerToken);
      }
    }
    prevSessionRef.current = session;
    if (!backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      setError(t('backendUrlMissing'));
      return;
    }

    // Fallback using a preconfigured streamer token
    const fetchStreamerInfo = async () => {
      if (isFallbackTriggered.current) return;
      isFallbackTriggered.current = true;
      try {
        const getToken = async () => {
          const tokenRes = await fetchWithTimeout(
            `${backendUrl}/api/streamer-token`
          );
          if (!tokenRes.ok) throw new Error(t('streamerTokenFetchFailed'));
          const { token: streamerToken } = (await tokenRes.json()) as {
            token?: string;
          };
          if (!streamerToken) throw new Error(t('streamerTokenFetchFailed'));
          return streamerToken;
        };

        let streamerToken = await getToken();
        const sHeaders = { Authorization: `Bearer ${streamerToken}` };
        let refreshPromise: Promise<string | undefined> | null = null;

        const refreshToken = async () => {
          const resp = await fetchWithTimeout(`${backendUrl}/refresh-token`);
          if (!resp.ok) return undefined;
          try {
            return await getToken();
          } catch {
            return undefined;
          }
        };

        const fetchStream = async (url: string) => {
          let resp = await fetchWithTimeout(url, { headers: sHeaders });
          if (resp.status === 401) {
            if (!refreshPromise) {
              refreshPromise = refreshToken();
            }
            const newToken = await refreshPromise;
            if (!newToken) {
              throw new Error(t('streamerTokenRefreshFailed'));
            }
            sHeaders.Authorization = `Bearer ${newToken}`;
            resp = await fetchWithTimeout(url, { headers: sHeaders });
            if (resp.status === 401) {
              throw new Error(t('streamerTokenUnauthorized'));
            }
          }
          return resp;
        };

        const userResp = await fetchStream(
          `${backendUrl}/api/get-stream?endpoint=users&login=${login}`
        );
        if (!userResp.ok) throw new Error(t('twitchUserFetchFailed'));
        const uData = await userResp.json();
        const me = uData.data?.[0];
        if (!me) throw new Error(t('twitchUserFetchFailed'));
        setProfileUrl(me.profile_image_url);
        if (!enableRoles) {
          setRoles([]);
          return;
        }
        const uid = me.id as string;
        let dbMonths = 0;
        try {
          const { data: dbUser } = await supabase
            .from("users")
            .select("total_months_subbed")
            .eq("twitch_login", login)
            .maybeSingle();
          dbMonths = dbUser?.total_months_subbed ?? 0;
        } catch {}
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
            await Promise.all([
              checkRole("moderation/moderators", "Mod"),
              checkRole("channels/vips", "VIP"),
              checkRole("subscriptions", "Sub"),
            ]);
        }
        if (!r.includes("Sub") && dbMonths > 0) r.push("Sub");
        setRoles(r);
        } catch (e) {
          console.error("Twitch API error", e);
          setProfileUrl(null);
          setRoles([]);
          if (e instanceof Error) {
            if (e.message === t('streamerTokenRefreshFailed')) {
              setError(null);
            } else {
              setError(e.message);
            }
            if (e.name === "AbortError") {
              return;
            }
          } else {
            setError(t('twitchInfoFetchFailed'));
          }
        }
      };

    if (!token) {
      fetchStreamerInfo();
      return;
    }

    const headers = { Authorization: `Bearer ${token}` } as Record<string, string>;

    // Helper to fetch Twitch endpoints with automatic token refresh on 401
    const fetchWithRefresh = async (url: string) => {
        let resp = await fetchWithTimeout(url, { headers });
      if (resp.status === 401) {
        const { token: newToken, error, noRefreshToken } = await refreshProviderToken();
        if (error || !newToken) {
          if (noRefreshToken) {
            console.warn('No refresh token available; falling back to streamer info');
            await fetchStreamerInfo();
            return null;
          }
          storeProviderToken(undefined);
          await notifySessionExpired();
          return null;
        }
        headers.Authorization = `Bearer ${newToken}`;
          resp = await fetchWithTimeout(url, { headers });
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
        let dbMonths = 0;
        try {
          const { data: dbUser } = await supabase
            .from("users")
            .select("total_months_subbed")
            .eq("twitch_login", login)
            .maybeSingle();
          dbMonths = dbUser?.total_months_subbed ?? 0;
        } catch {}
        const r: string[] = [];

        if (channelId) {
          const query = `broadcaster_id=${channelId}&user_id=${uid}`;
          let unauthorized = false;

          const checkRole = async (url: string, name: string) => {
            try {
              const resp = await fetchWithRefresh(
                `${backendUrl}/api/get-stream?endpoint=${url}&${query}`
              );
              if (!resp) return;
              if (resp.status === 401) {
                unauthorized = true;
                return;
              }
              if (!resp.ok) return;
              const d = await resp.json();
              if (d.data && d.data.length > 0) r.push(name);
            } catch {
              // ignore
            }
          };

          const roleChecks: Promise<void>[] = [];
          if (uid === channelId) {
            r.push("Streamer");
          }
          if (hasScope("moderation:read")) {
            roleChecks.push(checkRole("moderation/moderators", "Mod"));
          }
          if (hasScope("channel:read:vips")) {
            roleChecks.push(checkRole("channels/vips", "VIP"));
          }
          if (hasScope("channel:read:subscriptions")) {
            roleChecks.push(
              (async () => {
                const res = await fetchSubscriptionRole(backendUrl, query, r);
                if (res === "unauthorized") {
                  unauthorized = true;
                }
              })()
            );
          }

          await Promise.all(roleChecks);
          if (unauthorized) {
            await fetchStreamerInfo();
            return;
          }
        }

        if (!r.includes("Sub") && dbMonths > 0) r.push("Sub");

        setRoles(r);
      } catch (e) {
        console.error("Twitch API error", e);
        setError(t('twitchInfoFetchFailed'));
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        await fetchStreamerInfo();
      }
    };

    setError(null);
    fetchInfo();
  }, [twitchLogin, session, enableRoles]);

  return { profileUrl, roles, error };
}
