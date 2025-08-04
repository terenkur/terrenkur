"use client";

import { use, useEffect, useState } from "react";
import {
  getStoredProviderToken,
  storeProviderToken,
  refreshProviderToken,
} from "@/lib/twitch";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ROLE_ICONS } from "@/lib/roleIcons";
import type { Session } from "@supabase/supabase-js";

interface PollHistory {
  id: number;
  created_at: string;
  games: { id: number; name: string }[];
}

interface UserInfo {
  id: number;
  username: string;
  auth_id: string | null;
  logged_in: boolean;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const enableTwitchRoles = process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<PollHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const res = await fetch(`${backendUrl}/api/users/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setHistory(data.history || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

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

  // Store provider token for reloads
  useEffect(() => {
    const token = (session as any)?.provider_token as string | undefined;
    if (token) {
      storeProviderToken(token);
    }
  }, [session]);

  useEffect(() => {
    if (!enableTwitchRoles) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }
    if (!user || !user.logged_in) {
      setProfileUrl(null);
      setRoles([]);
      return;
    }
    if (!session || session.user.id !== user.auth_id) {
      // only show details for the logged-in user
      setProfileUrl(null);
      setRoles([]);
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
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    } as Record<string, string>;

    // Fetch helper to retry once when Twitch returns 401
    const fetchWithRefresh = async (url: string) => {
      let resp = await fetch(url, { headers });
      if (resp.status === 401) {
        const { token: newToken, error } = await refreshProviderToken();
        if (error || !newToken) {
          await supabase.auth.signOut();
          storeProviderToken(undefined);
          if (typeof window !== "undefined") {
            alert("Session expired. Please authorize again.");
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
          `${backendUrl}/api/get-stream?endpoint=users`
        );
        if (!userRes || userRes.status === 401) {
          console.warn("Unauthorized user info request – skipping role checks");
          setRoles([]);
          setProfileUrl(null);
          return;
        }
        if (!userRes.ok) throw new Error("user");
        const userData = await userRes.json();
        const me = userData.data?.[0];
        if (!me) throw new Error("user");
        setProfileUrl(me.profile_image_url);
        const uid = me.id as string;

        if (!channelId) {
          setRoles([]);
          return;
        }

        const r: string[] = [];
        if (uid === channelId) {
          r.push("Streamer");
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
          try {
            const stRes = await fetch(`${backendUrl}/api/streamer-token`);
            if (stRes.ok) {
              const stData = await stRes.json();
              const stToken = stData.token as string | undefined;
              if (stToken) {
                roleHeaders = { Authorization: `Bearer ${stToken}` };
              }
            }
          } catch {
            // ignore
          }
        }

        if (!roleHeaders) {
          setRoles(r);
          return;
        }

        const query = `broadcaster_id=${channelId}&user_id=${uid}`;

        const checkRole = async (url: string, name: string) => {
          try {
            const target = `${backendUrl}/api/get-stream?endpoint=${url}&${query}`;
            const resp = await fetch(target, { headers: roleHeaders! });
            if (resp.status === 401) {
              console.warn(`${name} role check unauthorized`);
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
              { headers: roleHeaders! }
            );
            if (resp.status === 401) {
              console.warn("Subscription role check unauthorized");
              return;
            }
            if (!resp.ok) return;
            const d = await resp.json();
            if (d.data && d.data.length > 0) r.push("Sub");
          } catch {
            // ignore
          }
        };

        await checkRole("moderation/moderators", "Mod");
        await checkRole("channels/vips", "VIP");
        await checkSub();

        setRoles(r);
      } catch (e) {
        console.error("Twitch API error", e);
        setRoles([]);
        setProfileUrl(null);
      }
    };

    fetchInfo();
  }, [session, user, enableTwitchRoles]);

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <div className="p-4">User not found.</div>;

  return (
    <main className="col-span-9 p-4 space-y-4">
      <Link href="/users" className="text-purple-600 underline">
        Back to users
      </Link>
      <h1 className="text-2xl font-semibold flex items-center space-x-2">
        {user.logged_in && session && session.user.id === user.auth_id && (
          <>
            {enableTwitchRoles &&
              roles.length > 0 &&
              roles.map((r) =>
                ROLE_ICONS[r] ? (
                  <img key={r} src={ROLE_ICONS[r]} alt={r} className="w-6 h-6" />
                ) : null
              )}
            {enableTwitchRoles && profileUrl && (
              <img
                src={profileUrl}
                alt="profile"
                className="w-10 h-10 rounded-full"
              />
            )}
          </>
        )}
        <span>{user.username}</span>
        {user.logged_in ? (
          <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">
            Logged in via site
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded">
            Not logged in via site
          </span>
        )}
      </h1>
      <p>
        <a
          href={`https://twitch.tv/${user.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 underline"
        >
          twitch.tv/{user.username}
        </a>
      </p>
      {history.length === 0 ? (
        <p>No votes yet.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((poll) => (
            <li key={poll.id} className="border p-2 rounded-lg bg-muted space-y-1">
              <h2 className="font-semibold">
                <Link
                  href={`/archive/${poll.id}`}
                  className="text-purple-600 underline"
                >
                  Roulette from {new Date(poll.created_at).toLocaleString()}
                </Link>
              </h2>
              <ul className="pl-4 list-disc">
                {poll.games.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/games/${g.id}`}
                      className="underline text-purple-600"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
