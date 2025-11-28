"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import {
  getStoredProviderToken,
  storeProviderToken,
  refreshProviderToken,
} from "@/lib/twitch";
import { Button } from "@/components/ui/button";
import { ROLE_ICONS, getSubBadge } from "@/lib/roleIcons";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { notifySessionExpired } from "@/lib/sessionExpired";

import type { Session } from "@supabase/supabase-js";

export default function AuthStatus() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [subMonths, setSubMonths] = useState<number>(0);
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const streamerTokenMissingRef = useRef(false);
  const skipRoleChecksRef = useRef(false);
  const roleCheckPerformedRef = useRef(false);
  const rolesEnabled =
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchId = async () => {
      if (!session) {
        setUserId(null);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('id, total_months_subbed')
        .eq('auth_id', session.user.id)
        .maybeSingle();
      setUserId(data?.id ?? null);
      setSubMonths(data?.total_months_subbed ?? 0);
    };
    fetchId();
  }, [session]);

  // Persist the provider token for page reloads
  useEffect(() => {
    const prevSession = prevSessionRef.current;
    if (!session) {
      if (prevSession) {
        storeProviderToken(undefined);
      }
    } else {
      const token = (session as any)?.provider_token as string | undefined;
      if (token) {
        storeProviderToken(token);
      }
    }
    prevSessionRef.current = session;
  }, [session]);

  // Reset role-check state when session changes
  useEffect(() => {
    skipRoleChecksRef.current = false;
    streamerTokenMissingRef.current = false;
    roleCheckPerformedRef.current = false;
  }, [session]);

  useEffect(() => {
    if (!rolesEnabled) {
      setProfileUrl((prev) => (prev === null ? prev : null));
      setRoles((prev) => (prev.length === 0 ? prev : []));
      setScopeWarning((prev) => (prev === null ? prev : null));
      return;
    }
    if (!session) {
      setProfileUrl((prev) => (prev === null ? prev : null));
      setRoles((prev) => (prev.length === 0 ? prev : []));
      setScopeWarning((prev) => (prev === null ? prev : null));
      return;
    }
    if (skipRoleChecksRef.current || roleCheckPerformedRef.current) {
      return;
    }
    roleCheckPerformedRef.current = true;
    const token =
      ((session as any)?.provider_token as string | undefined) ||
      getStoredProviderToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    const login =
      session?.user.user_metadata.preferred_username ||
      session?.user.user_metadata.name ||
      session?.user.user_metadata.full_name ||
      session?.user.user_metadata.nickname ||
      session?.user.email ||
      null;
    if (!backendUrl || !login) {
      setProfileUrl((prev) => (prev === null ? prev : null));
      setRoles((prev) => (prev.length === 0 ? prev : []));
      skipRoleChecksRef.current = true;
      setScopeWarning((prev) =>
        prev === t('twitchInfoFetchFailed') ? prev : t('twitchInfoFetchFailed')
      );
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    } as Record<string, string>;

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

    const loginLower = login.toLowerCase();
    let streamerFallbackTriggered = false;

    const fetchStreamerInfo = async () => {
      streamerFallbackTriggered = true;
      try {
        const getStreamerToken = async () => {
          const tokenRes = await fetchWithTimeout(
            `${backendUrl}/api/streamer-token`
          );
          if (!tokenRes.ok) {
            throw new Error('streamer-token');
          }
          const { token: streamerToken } = (await tokenRes.json()) as {
            token?: string;
          };
          if (!streamerToken) {
            throw new Error('streamer-token');
          }
          return streamerToken;
        };

        let streamerToken = await getStreamerToken();
        const streamerHeaders = {
          Authorization: `Bearer ${streamerToken}`,
        } as Record<string, string>;
        let refreshing: Promise<string | undefined> | null = null;

        const fetchStream = async (url: string) => {
          if (!backendUrl) {
            throw new Error('backend');
          }
          let resp = await fetchWithTimeout(url, { headers: streamerHeaders });
          if (resp.status === 401) {
            if (!refreshing) {
              refreshing = (async () => {
                try {
                  const refreshRes = await fetchWithTimeout(
                    `${backendUrl}/refresh-token`
                  );
                  if (!refreshRes.ok) {
                    return undefined;
                  }
                  return await getStreamerToken();
                } catch {
                  return undefined;
                }
              })();
            }
            const newToken = await refreshing;
            if (!newToken) {
              throw new Error('streamer-refresh');
            }
            streamerHeaders.Authorization = `Bearer ${newToken}`;
            resp = await fetchWithTimeout(url, { headers: streamerHeaders });
            if (resp.status === 401) {
              throw new Error('streamer-unauthorized');
            }
          }
          return resp;
        };

        const loginParam = encodeURIComponent(loginLower);
        const userRes = await fetchStream(
          `${backendUrl}/api/get-stream?endpoint=users&login=${loginParam}`
        );
        if (!userRes.ok) {
          throw new Error('user');
        }
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) {
          throw new Error('user');
        }
        setProfileUrl(me.profile_image_url);

        const r: string[] = [];
        const uid = me.id as string | undefined;
        if (channelId && uid) {
          const query = `broadcaster_id=${channelId}&user_id=${uid}`;
          const checkRole = async (endpoint: string, name: string) => {
            try {
              const resp = await fetchStream(
                `${backendUrl}/api/get-stream?endpoint=${endpoint}&${query}`
              );
              if (!resp.ok) return;
              const data = await resp.json();
              if (data.data && data.data.length > 0) {
                r.push(name);
              }
            } catch (err) {
              if (err instanceof Error && err.message === 'streamer-unauthorized') {
                throw err;
              }
            }
          };

          if (uid === channelId) {
            r.push('Streamer');
          }
          await Promise.all([
            checkRole('moderation/moderators', 'Mod'),
            checkRole('channels/vips', 'VIP'),
            checkRole('subscriptions', 'Sub'),
          ]);
        }

        if (!r.includes('Sub') && subMonths > 0) {
          r.push('Sub');
        }

        setRoles(r);
        setScopeWarning(null);
        return true;
      } catch (err) {
        console.error('Streamer fallback error', err);
        skipRoleChecksRef.current = true;
        setRoles([]);
        setProfileUrl(null);
        setScopeWarning(t('twitchInfoFetchFailed'));
        return false;
      }
    };

    // Helper to fetch Twitch data and refresh the provider token once on 401
    const fetchWithRefresh = async (url: string) => {
      if (streamerFallbackTriggered) {
        return null;
      }
      let resp = await fetchWithTimeout(url, { headers });
      if (resp.status === 401) {
        const {
          token: newToken,
          error,
          noRefreshToken,
        } = await refreshProviderToken();
        if (error || !newToken) {
          if (noRefreshToken) {
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
      if (!token) {
        await fetchStreamerInfo();
        return;
      }
      try {
        const userRes = await fetchWithRefresh(
          `${backendUrl}/api/get-stream?endpoint=users`
        );
        if (!userRes) {
          if (streamerFallbackTriggered) {
            return;
          }
          skipRoleChecksRef.current = true;
          setScopeWarning(t('twitchInfoFetchFailed'));
          return;
        }
        if (userRes.status === 401) {
          skipRoleChecksRef.current = true;
          setRoles([]);
          setProfileUrl(null);
          setScopeWarning(t('twitchInfoFetchFailed'));
          return;
        }
        if (!userRes.ok) {
          skipRoleChecksRef.current = true;
          setScopeWarning(t('twitchInfoFetchFailed'));
          return;
        }
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error('user');
        setProfileUrl(me.profile_image_url);
        const uid = me.id as string;

        if (!channelId) {
          setRoles([]);
          return;
        }

        const r: string[] = [];
        if (uid === channelId) {
          r.push('Streamer');
        }

          let stToken: string | undefined;
          let validateRes: Response | null = null;
          if (!streamerTokenMissingRef.current ||
              (uid === channelId && (session as any)?.provider_token)) {
            try {
              const stPromise = streamerTokenMissingRef.current
                ? Promise.resolve(null)
                : fetchWithTimeout(`${backendUrl}/api/streamer-token`).catch(
                    () => null
                  );
              const validatePromise =
                uid === channelId && (session as any)?.provider_token
                  ? fetchWithRefresh("https://id.twitch.tv/oauth2/validate").catch(
                      () => null
                    )
                  : Promise.resolve(null);
              const [stRes, vRes] = await Promise.all([stPromise, validatePromise]);
              validateRes = vRes;
              if (stRes) {
                if (stRes.status === 404) {
                  streamerTokenMissingRef.current = true;
                } else if (stRes.ok) {
                  const stData = await stRes.json();
                  stToken = stData.token;
                } else {
                  skipRoleChecksRef.current = true;
                  setScopeWarning(t('streamerTokenFetchFailed'));
                  return;
                }
              }
            } catch {
              skipRoleChecksRef.current = true;
              setScopeWarning(t('streamerTokenFetchFailed'));
              return;
            }
          }

          let roleHeaders: Record<string, string> | null = null;
          if (validateRes && validateRes.ok) {
            try {
              const { scopes = [] } = (await validateRes.json()) as {
                scopes?: string[];
              };
              const required = [
                "moderation:read",
                "channel:read:vips",
                "channel:read:subscriptions",
              ];
              if (required.every((s) => scopes.includes(s))) {
                roleHeaders = headers;
              }
            } catch {
              /* ignore */
            }
          }

        if (!roleHeaders) {
          if (!stToken) {
            setRoles(r);
            setScopeWarning(null);
            return;
          }
          roleHeaders = { Authorization: `Bearer ${stToken}` };
        }
        const query = `broadcaster_id=${channelId}&user_id=${uid}`;
        let missingScopes = false;
        let attemptedStreamerRefresh = false;
        let skipFurtherChecks = false;
        const usingStreamerToken =
          !!stToken && roleHeaders.Authorization === `Bearer ${stToken}`;

        const handleStreamer401 = async () => {
          if (attemptedStreamerRefresh) {
            skipRoleChecksRef.current = true;
            skipFurtherChecks = true;
            setScopeWarning(t('streamerTokenUnauthorized'));
            return false;
          }
          attemptedStreamerRefresh = true;
          try {
            await fetchWithTimeout(`${backendUrl}/refresh-token`);
            const newTokRes = await fetchWithTimeout(
              `${backendUrl}/api/streamer-token`
            );
            if (newTokRes.ok) {
              const { token: newTok } = await newTokRes.json();
              if (newTok) {
                roleHeaders.Authorization = `Bearer ${newTok}`;
                return true;
              }
            }
          } catch {
            /* ignore */
          }
          skipRoleChecksRef.current = true;
          skipFurtherChecks = true;
          setScopeWarning(t('streamerTokenRefreshFailed'));
          return false;
        };

        const checkRole = async (url: string, name: string) => {
          if (skipFurtherChecks) return;
          try {
            const target = `${backendUrl}/api/get-stream?endpoint=${url}&${query}`;
            let resp = await fetchWithTimeout(target, { headers: roleHeaders });
            if (resp.status === 401 && usingStreamerToken) {
              const refreshed = await handleStreamer401();
              if (refreshed) {
                resp = await fetchWithTimeout(target, { headers: roleHeaders });
              } else {
                return;
              }
            }
            if (resp.status === 401) {
              if (usingStreamerToken) {
                skipRoleChecksRef.current = true;
                skipFurtherChecks = true;
                setScopeWarning(t('streamerTokenUnauthorized'));
              } else {
                console.warn(`${name} role check unauthorized`);
                missingScopes = true;
              }
              return;
            }
            if (!resp.ok) {
              console.warn(
                `${name} role check failed with status ${resp.status}`
              );
              return;
            }
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push(name);
            } catch (e) {
              if (e instanceof Error && e.name === "AbortError") {
                skipRoleChecksRef.current = true;
                skipFurtherChecks = true;
                setScopeWarning(t('twitchInfoFetchFailed'));
              }
            }
          };

        const checkSub = async () => {
          if (skipFurtherChecks) return;
          try {
            let resp = await fetchWithTimeout(
              `${backendUrl}/api/get-stream?endpoint=subscriptions&${query}`,
              { headers: roleHeaders }
            );
            if (resp.status === 401 && usingStreamerToken) {
              const refreshed = await handleStreamer401();
              if (refreshed) {
                resp = await fetchWithTimeout(
                  `${backendUrl}/api/get-stream?endpoint=subscriptions&${query}`,
                  { headers: roleHeaders }
                );
              } else {
                return;
              }
            }
            if (resp.status === 401) {
              if (usingStreamerToken) {
                skipRoleChecksRef.current = true;
                skipFurtherChecks = true;
                setScopeWarning(t('streamerTokenUnauthorized'));
              } else {
                missingScopes = true;
              }
              return;
            }
            if (!resp.ok) return;
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push('Sub');
            } catch (e) {
              if (e instanceof Error && e.name === "AbortError") {
                skipRoleChecksRef.current = true;
                skipFurtherChecks = true;
                setScopeWarning(t('twitchInfoFetchFailed'));
              }
            }
          };

        await checkRole('moderation/moderators', 'Mod');
        if (!skipFurtherChecks) await checkRole('channels/vips', 'VIP');
        if (!skipFurtherChecks) await checkSub();

        setRoles(r);
        if (missingScopes && (r.includes('Streamer') || r.includes('Mod'))) {
          setScopeWarning(t('scopeWarning'));
        } else {
          setScopeWarning(null);
        }
      } catch (e) {
        console.error('Twitch API error', e);
        skipRoleChecksRef.current = true;
        setScopeWarning(t('twitchInfoFetchFailed'));
        setRoles([]);
        setProfileUrl(null);
      }
    };

    fetchInfo();
  }, [session, rolesEnabled, t]);

  const debugPkceCheck = () => {
    if (process.env.NODE_ENV === "production") return;
    const hasCvKey = Object.keys(localStorage).some((key) =>
      key.startsWith("sb-cv-")
    );
    if (!hasCvKey) {
      const msg = t('missingPkce');
      console.warn(msg);
      try {
        alert(msg);
      } catch {
        /* no-op */
      }
    }
  };

  const handleLogin = async () => {
    let scopes = rolesEnabled
      ? "user:read:email moderation:read channel:read:vips channel:read:subscriptions"
      : "user:read:email";
    if (roles.includes("Streamer")) {
      scopes += " channel:manage:redemptions";
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes,
      },
    });
    setTimeout(debugPkceCheck, 500);
    if (error) {
      console.error("OAuth login error", error);
      alert(t('oauthError', { error: error.message }));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    storeProviderToken(undefined);
  };

  const username =
    session?.user.user_metadata.preferred_username ||
    session?.user.user_metadata.name ||
    session?.user.user_metadata.full_name ||
    session?.user.user_metadata.nickname ||
    session?.user.email;

  const subBadge = getSubBadge(subMonths);

  return session ? (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 truncate max-w-xs">
              {rolesEnabled &&
                roles.length > 0 &&
                roles.map((r) =>
                  r === "Sub"
                    ? subBadge
                      ? (
                          <Image
                            key={r}
                            src={subBadge}
                            alt={t(`roles.${r}`)}
                            width={16}
                            height={16}
                            className="w-4 h-4"
                            loading="lazy"
                          />
                        )
                      : null
                    : ROLE_ICONS[r]
                    ? (
                        <Image
                          key={r}
                          src={ROLE_ICONS[r]}
                          alt={t(`roles.${r}`)}
                          width={16}
                          height={16}
                          className="w-4 h-4"
                          loading="lazy"
                        />
                      )
                    : null
                )}
              {username}
            </span>
            {profileUrl && (
              <Image
                src={profileUrl}
                alt={t('profile')}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full"
                priority
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {userId && (
            <DropdownMenuItem asChild>
              <Link href={`/users/${userId}`}>{t('profile')}</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={handleLogout}>
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {rolesEnabled && scopeWarning && (
        <p className="text-xs text-red-500 mt-2">
          {scopeWarning}{" "}
          <button
            onClick={handleLogin}
            className="underline focus:outline-none"
          >
            {t('reauthorize')}
          </button>
        </p>
      )}
    </>
  ) : (
    <>
      <Button
        onClick={handleLogin}
        size="icon"
        aria-label={t('loginWithTwitch')}
        className="sm:w-auto sm:px-4"
      >
        <Image
          src="/icons/socials/twitch.svg"
          alt="Twitch"
          width={24}
          height={24}
          className="w-6 h-6 invert"
          priority
        />
        <span className="hidden sm:inline ml-2">{t('loginWithTwitch')}</span>
      </Button>
      {rolesEnabled && scopeWarning && (
        <p className="text-xs text-red-500 mt-2">
          {scopeWarning}{" "}
          <button
            onClick={handleLogin}
            className="underline focus:outline-none"
          >
            {t('reauthorize')}
          </button>
        </p>
      )}
    </>
  );
}
