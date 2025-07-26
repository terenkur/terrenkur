"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserRef {
  id: number;
  username: string;
}

interface GameEntry {
  id: number;
  name: string;
  status: string;
  rating: number | null;
  selection_method: string | null;
  initiators: UserRef[];
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function GamesPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const resp = await fetch(`${backendUrl}/api/games`);
      if (!resp.ok) {
        setLoading(false);
        return;
      }
      const data = await resp.json();
      setGames(data.games || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  if (loading) return <div className="p-4">Loading...</div>;

  const active = games.filter((g) => g.status === "active");
  const completed = games.filter((g) => g.status === "completed");
  const backlog = games.filter((g) => g.status !== "completed" && g.status !== "active");

  const renderInitiators = (inits: UserRef[]) => (
    <span className="space-x-1">
      {inits.map((u, i) => (
        <Link key={u.id} href={`/users/${u.id}`} className="underline text-purple-600">
          {u.username}
          {i < inits.length - 1 ? "," : ""}
        </Link>
      ))}
    </span>
  );

  const renderGame = (g: GameEntry) => (
    <li key={g.id} className="border p-2 rounded space-y-1">
      <div className="flex items-center space-x-2">
        <span className="flex-grow">{g.name}</span>
        {g.rating !== null && <span className="font-mono">{g.rating}/10</span>}
        {g.selection_method && (
          <span className="text-sm text-gray-600">({g.selection_method})</span>
        )}
      </div>
      {g.initiators.length > 0 && (
        <div className="text-sm text-gray-700">Initiators: {renderInitiators(g.initiators)}</div>
      )}
    </li>
  );

  return (
    <main className="p-4 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Games</h1>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Active Roulette</h2>
        {active.length === 0 ? <p>No games.</p> : <ul className="space-y-2">{active.map(renderGame)}</ul>}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Completed</h2>
        {completed.length === 0 ? <p>No games.</p> : <ul className="space-y-2">{completed.map(renderGame)}</ul>}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Backlog</h2>
        {backlog.length === 0 ? <p>No games.</p> : <ul className="space-y-2">{backlog.map(renderGame)}</ul>}
      </section>
    </main>
  );
}
