"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TOKEN_KEY = 'twitch_provider_token';
import type { Session } from "@supabase/supabase-js";

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

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

  // Persist the provider token for page reloads
  useEffect(() => {
    const token = (session as any)?.provider_token as string | undefined;
    if (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {
        // ignore storage failures
      }
    }
  }, [session]);

  useEffect(() => {
    const token =
      ((session as any)?.provider_token as string | undefined) ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem(TOKEN_KEY) || undefined
        : undefined);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!token || !backendUrl) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const fetchInfo = async () => {
      try {
        const userRes = await fetch(
          `${backendUrl}/api/get-stream?endpoint=users`,
          { headers }
        );
        if (!userRes.ok) throw new Error('user');
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error('user');
        setProfileUrl(me.profile_image_url);
        const uid = me.id as string;

        const r: string[] = [];
        if (channelId && uid === channelId) r.push('Streamer');

        const query = `broadcaster_id=${channelId}&user_id=${uid}`;
        const checkRole = async (url: string, name: string) => {
          try {
            const resp = await fetch(`${backendUrl}/api/get-stream?endpoint=${url}&${query}`, { headers });
            if (!resp.ok) return; // likely missing scope
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push(name);
          } catch {
            // ignore
          }
        };

        if (channelId) {
          await checkRole('moderation/moderators', 'Mod');
          await checkRole('channels/vips', 'VIP');
          await checkRole('subscriptions', 'Sub');
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
        scopes:
          "user:read:email moderation:read channel:read:vips channel:read:subscriptions",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage failures
    }
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
          <span className="truncate max-w-xs">
            {username}
            {roles.length > 0 && <> ({roles.join(', ')})</>}
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
        <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button onClick={handleLogin}>Login with Twitch</Button>
  );
}
