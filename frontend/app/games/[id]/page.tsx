"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { proxiedImage, cn } from "@/lib/utils";

interface UserRef {
  id: number;
  username: string;
  count?: number;
}

interface PollInfo {
  id: number;
  created_at: string;
  archived: boolean;
  voters: UserRef[];
}

interface GameInfo {
  id: number;
  name: string;
  background_image: string | null;
  status: string;
  rating: number | null;
  selection_method: string | null;
  initiators: UserRef[];
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const res = await fetch(`${backendUrl}/api/games/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setGame(data.game);
      setPolls(data.polls || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!game) return <div className="p-4">Game not found.</div>;

  const renderUsers = (list: UserRef[]) => (
    <span className="space-x-1">
      {list.map((u, i) => (
        <Link key={u.id} href={`/users/${u.id}`} className="underline text-purple-600">
          {u.username}
          {u.count ? ` (${u.count})` : ""}
          {i < list.length - 1 ? "," : ""}
        </Link>
      ))}
    </span>
  );

  return (
    <main className="col-span-9 p-4 space-y-4">
      <Link href="/games" className="text-purple-600 underline">
        Back to games
      </Link>
      <h1
        className={cn(
          "text-2xl font-semibold relative overflow-hidden",
          game.background_image ? "text-white" : "bg-gray-700 p-2 text-white"
        )}
      >
        {game.background_image && (
          <div
            className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
            style={{ backgroundImage: `url(${proxiedImage(game.background_image)})` }}
          />
        )}
        <span className="flex items-center space-x-2 relative z-10">
          <span>{game.name}</span>
          {game.rating !== null && <span className="font-mono">{game.rating}/10</span>}
          {game.selection_method && (
            <span className="text-sm text-gray-600">({game.selection_method})</span>
          )}
        </span>
      </h1>
      <p>Status: {game.status}</p>
      {game.initiators.length > 0 && <p>Initiators: {renderUsers(game.initiators)}</p>}
      {polls.length === 0 ? (
        <p>No roulettes yet.</p>
      ) : (
        <ul className="space-y-2">
          {polls.map((p) => (
            <li key={p.id} className="border p-2 rounded-lg bg-muted space-y-1">
              <Link href={`/archive/${p.id}`} className="text-purple-600 underline">
                Roulette from {new Date(p.created_at).toLocaleString()}
              </Link>
              <div className="pl-4">
                {p.voters.map((v) => (
                  <div key={v.id} className="text-sm">
                    {v.count} <Link href={`/users/${v.id}`} className="underline text-purple-600">{v.username}</Link>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
