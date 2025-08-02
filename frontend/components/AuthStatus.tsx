"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  fetchSubscriptionRole,
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
    const token = (session as any)?.provider_token as string | undefined;
    if (token) {
      storeProviderToken(token);
    }
  }, [session]);

  useEffect(() => {
    const token =
      ((session as any)?.provider_token as string | undefined) ||
      getStoredProviderToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!token || !backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    } as Record<string, string>;

    // Helper to fetch Twitch data and refresh the provider token once on 401
    const fetchWithRefresh = async (url: string) => {
      let resp = await fetch(url, { headers });
      if (resp.status === 401) {
        const newToken = await refreshProviderToken();
        if (!newToken) {
          await supabase.auth.signOut();
          storeProviderToken(undefined);
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
            'Unauthorized user info request – possible missing scopes; skipping role checks'
          );
          setRoles([]);
          setProfileUrl(null);
          return;
        }
        if (!userRes.ok) throw new Error('user');
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error('user');
        setProfileUrl(me.profile_image_url);
        const uid = me.id as string;

        const r: string[] = [];

        if (channelId && uid === channelId) {
          r.push('Streamer');

          const query = `broadcaster_id=${channelId}&user_id=${uid}`;
          const checkRole = async (url: string, name: string) => {
            try {
              const resp = await fetchWithRefresh(
                `${backendUrl}/api/get-stream?endpoint=${url}&${query}`
              );
              if (!resp || resp.status === 401) {
                console.warn(
                  `${name} role check unauthorized – missing scope?`
                );
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
            const res = await fetchSubscriptionRole(
              backendUrl,
              query,
              headers,
              r
            );
            if (res !== 'ok') {
              console.warn(`Subscription role check result: ${res}`);
            }
          };

          await checkRole('moderation/moderators', 'Mod');
          await checkRole('channels/vips', 'VIP');
          await checkSub();
        }

        setRoles(r);
      } catch (e) {
        console.error('Twitch API error', e);
        setRoles([]);
        setProfileUrl(null);
      }
    };

    fetchInfo();
  }, [session]);

  const handleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "user:read:email",
      },
    });
  };

  const handleStreamerLogin = () => {
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!channelId || !roles.includes("Streamer")) return;
    supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:
          "user:read:email moderation:read channel:read:vips channel:read:subscriptions channel:read:redemptions",
      },
    });
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2">
          <span className="flex items-center space-x-1 truncate max-w-xs">
            {roles.length > 0 &&
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
        {roles.includes("Streamer") && (
          <DropdownMenuItem onSelect={handleStreamerLogin}>
            Streamer login
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button onClick={handleLogin}>Login with Twitch</Button>
  );
}
