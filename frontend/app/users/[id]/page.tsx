"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_ICONS } from "@/lib/roleIcons";
import { useTwitchUserInfo } from "@/lib/useTwitchUserInfo";

interface PollHistory {
  id: number;
  created_at: string;
  games: { id: number; name: string }[];
}

interface UserInfo {
  id: number;
  username: string;
  auth_id: string | null;
  twitch_login: string | null;
  logged_in: boolean;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const enableTwitchRoles = process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<PollHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { profileUrl, roles } = useTwitchUserInfo(user ? user.twitch_login : null);

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

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <div className="p-4">User not found.</div>;

  return (
    <main className="col-span-9 p-4 space-y-4">
      <Link href="/users" className="text-purple-600 underline">
        Back to users
      </Link>
      <h1 className="text-2xl font-semibold flex items-center space-x-2">
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
