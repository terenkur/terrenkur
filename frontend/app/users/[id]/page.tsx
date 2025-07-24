"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface PollHistory {
  id: number;
  created_at: string;
  games: { id: number; name: string }[];
}

interface UserInfo {
  id: number;
  username: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<PollHistory[]>([]);
  const [loading, setLoading] = useState(true);

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
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <Link href="/users" className="text-purple-600 underline">
        Back to users
      </Link>
      <h1 className="text-2xl font-semibold">{user.username}</h1>
      {history.length === 0 ? (
        <p>No votes yet.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((poll) => (
            <li key={poll.id} className="border p-2 rounded space-y-1">
              <h2 className="font-semibold">
                Roulette from {new Date(poll.created_at).toLocaleString()}
              </h2>
              <ul className="pl-4 list-disc">
                {poll.games.map((g) => (
                  <li key={g.id}>{g.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
