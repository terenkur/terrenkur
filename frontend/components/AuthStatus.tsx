"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  getStoredProviderToken,
  storeProviderToken,
  refreshProviderToken,
} from "@/lib/twitch";
import { Button } from "@/components/ui/button";
import { ROLE_ICONS } from "@/lib/roleIcons";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Session } from "@supabase/supabase-js";

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const [streamerTokenMissing, setStreamerTokenMissing] = useState(false);
  const rolesEnabled =
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

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
        .select('id')
        .eq('auth_id', session.user.id)
        .maybeSingle();
      setUserId(data?.id ?? null);
    };
    fetchId();
  }, [session]);

  // Persist the provider token for page reloads
  useEffect(() => {
    if (!session) {
      storeProviderToken(undefined);
      return;
    }
    const token = (session as any)?.provider_token as string | undefined;
    if (token) {
      storeProviderToken(token);
    }
  }, [session]);

  useEffect(() => {
    if (!rolesEnabled) {
      setProfileUrl(null);
      setRoles([]);
      setScopeWarning(null);
      return;
    }
    if (!session) {
      setProfileUrl(null);
      setRoles([]);
      setScopeWarning(null);
      storeProviderToken(undefined);
      return;
    }
    const token =
      ((session as any)?.provider_token as string | undefined) ||
      getStoredProviderToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!token || !backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      setScopeWarning(null);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    } as Record<string, string>;

    // Helper to fetch Twitch data and refresh the provider token once on 401
    const fetchWithRefresh = async (url: string) => {
      let resp = await fetch(url, { headers });
      if (resp.status === 401) {
        const { token: newToken, error } = await refreshProviderToken();
        if (error || !newToken) {
          await supabase.auth.signOut();
          storeProviderToken(undefined);
          alert('Session expired. Please authorize again.');
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
          `${backendUrl}/api/get-stream?endpoint=users`
        );
        if (!userRes) {
          console.warn('No response from /api/get-stream for user info');
          return;
        }
        if (userRes.status === 401) {
          console.warn(
            'Unauthorized user info request – skipping role checks'
          );
          setRoles([]);
          setProfileUrl(null);
          setScopeWarning(null);
          return;
        }
        if (!userRes.ok) throw new Error('user');
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
        if (!streamerTokenMissing) {
          try {
            const stRes = await fetch(`${backendUrl}/api/streamer-token`);
            if (stRes.status === 404) {
              setStreamerTokenMissing(true);
            } else if (stRes.ok) {
              const stData = await stRes.json();
              stToken = stData.token;
            }
          } catch {
            // ignore
          }
        }

        let roleHeaders: Record<string, string> | null = null;
        if (uid === channelId && (session as any)?.provider_token) {
          try {
            const validateRes = await fetchWithRefresh(
              "https://id.twitch.tv/oauth2/validate"
            );
            if (validateRes && validateRes.ok) {
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
            }
          } catch {
            // ignore
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

        const checkRole = async (url: string, name: string) => {
          try {
            const target = `${backendUrl}/api/get-stream?endpoint=${url}&${query}`;
            const resp = await fetch(target, { headers: roleHeaders });
            if (resp.status === 401) {
              console.warn(`${name} role check unauthorized`);
              missingScopes = true;
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
          } catch {
            // ignore
          }
        };

        const checkSub = async () => {
          try {
            const resp = await fetch(
              `${backendUrl}/api/get-stream?endpoint=subscriptions&${query}`,
              { headers: roleHeaders }
            );
            if (resp.status === 401) {
              missingScopes = true;
              return;
            }
            if (!resp.ok) return;
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push('Sub');
          } catch {
            // ignore
          }
        };

        await checkRole('moderation/moderators', 'Mod');
        await checkRole('channels/vips', 'VIP');
        await checkSub();

        setRoles(r);
        if (missingScopes && (r.includes('Streamer') || r.includes('Mod'))) {
          setScopeWarning(
            'Для проверки ролей нужен повторный вход с дополнительными правами…'
          );
        } else {
          setScopeWarning(null);
        }
      } catch (e) {
        console.error('Twitch API error', e);
        setRoles([]);
        setProfileUrl(null);
      }
    };

    fetchInfo();
  }, [session, rolesEnabled, streamerTokenMissing]);

  const debugPkceCheck = () => {
    if (process.env.NODE_ENV === "production") return;
    const hasCvKey = Object.keys(localStorage).some((key) =>
      key.startsWith("sb-cv-")
    );
    if (!hasCvKey) {
      const msg =
        "Missing PKCE verifier in localStorage. Please retry login from the same tab.";
      console.warn(msg);
      try {
        alert(msg);
      } catch {
        /* no-op */
      }
    }
  };

  const handleLogin = async () => {
    const scopes = rolesEnabled
      ? "user:read:email moderation:read channel:read:vips channel:read:subscriptions"
      : "user:read:email";
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
      alert(error.message);
    }
  };

  const handleStreamerLogin = async () => {
    if (!rolesEnabled) return;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!channelId || !roles.includes("Streamer")) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:
          "user:read:email moderation:read channel:read:vips channel:read:subscriptions channel:read:redemptions",
      },
    });
    setTimeout(debugPkceCheck, 500);
    if (error) {
      console.error("OAuth streamer login error", error);
      alert(error.message);
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

  return session ? (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 truncate max-w-xs">
              {rolesEnabled &&
                roles.length > 0 &&
                roles.map((r) =>
                  ROLE_ICONS[r] ? (
                    <img key={r} src={ROLE_ICONS[r]} alt={r} className="w-4 h-4" />
                  ) : null
                )}
              {username}
            </span>
            {profileUrl && (
              <img
                src={profileUrl}
                alt="profile"
                className="w-6 h-6 rounded-full"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {userId && (
            <DropdownMenuItem asChild>
              <Link href={`/users/${userId}`}>Profile</Link>
            </DropdownMenuItem>
          )}
          {rolesEnabled &&
            roles.includes("Streamer") && (
              <DropdownMenuItem onSelect={handleStreamerLogin}>
                Streamer login
              </DropdownMenuItem>
            )}
          <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {rolesEnabled && scopeWarning && (
        <p className="text-xs text-red-500 mt-2">
          {scopeWarning}{" "}
          <button
            onClick={handleLogin}
            className="underline focus:outline-none"
          >
            Reauthorize
          </button>
        </p>
      )}
    </>
  ) : (
    <>
      <Button onClick={handleLogin}>Login with Twitch</Button>
      {rolesEnabled && scopeWarning && (
        <p className="text-xs text-red-500 mt-2">
          {scopeWarning}{" "}
          <button
            onClick={handleLogin}
            className="underline focus:outline-none"
          >
            Reauthorize
          </button>
        </p>
      )}
    </>
  );
}
