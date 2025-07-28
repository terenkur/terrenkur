"use client";

import { supabase } from "@/utils/supabaseClient";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const token = (session as any)?.provider_token as string | undefined;
    const clientId = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
    const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;
    if (!token || !clientId) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }

    const headers = {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    };

    const fetchInfo = async () => {
      try {
        const userRes = await fetch('https://api.twitch.tv/helix/users', {
          headers,
        });
        if (!userRes.ok) throw new Error('user');
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error('user');
        setProfileUrl(me.profile_image_url);
        const uid = me.id as string;

        const r: string[] = [];
        if (channelId && uid === channelId) r.push('Streamer');

        const query = `?broadcaster_id=${channelId}&user_id=${uid}`;
        const checkRole = async (url: string, name: string) => {
          try {
            const resp = await fetch(url + query, { headers });
            if (!resp.ok) return; // likely missing scope
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push(name);
          } catch {
            // ignore
          }
        };

        if (channelId) {
          await checkRole('https://api.twitch.tv/helix/moderation/moderators', 'Mod');
          await checkRole('https://api.twitch.tv/helix/channels/vips', 'VIP');
          await checkRole('https://api.twitch.tv/helix/subscriptions', 'Sub');
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
  };

  const username =
    session?.user.user_metadata.preferred_username ||
    session?.user.user_metadata.name ||
    session?.user.user_metadata.full_name ||
    session?.user.user_metadata.nickname ||
    session?.user.email;

  return session ? (
    <div className="flex items-center space-x-2">
      {profileUrl && (
        <img
          src={profileUrl}
          alt="profile"
          className="w-6 h-6 rounded-full"
        />
      )}
      <span className="truncate max-w-xs">
        {username}
        {roles.length > 0 && (
          <> ({roles.join(', ')})</>
        )}
      </span>
      <button
        className="px-2 py-1 bg-gray-800 text-white rounded"
        onClick={handleLogout}
      >
        Log out
      </button>
    </div>
  ) : (
    <button
      className="px-4 py-2 bg-purple-600 text-white rounded"
      onClick={handleLogin}
    >
      Login with Twitch
    </button>
  );
}
