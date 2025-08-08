"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PopularGame {
  id: number;
  name: string;
  votes: number;
}

interface TopVoter {
  id: number;
  username: string;
  votes: number;
}

interface GameRoulette {
  id: number;
  name: string;
  roulettes: number;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function StatsPage() {
  const [games, setGames] = useState<PopularGame[]>([]);
  const [voters, setVoters] = useState<TopVoter[]>([]);
  const [roulettes, setRoulettes] = useState<GameRoulette[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!backendUrl) return;
    Promise.all([
      fetch(`${backendUrl}/api/stats/popular-games`).then((r) =>
        r.ok ? r.json() : { games: [] }
      ),
      fetch(`${backendUrl}/api/stats/top-voters`).then((r) =>
        r.ok ? r.json() : { users: [] }
      ),
      fetch(`${backendUrl}/api/stats/game-roulettes`).then((r) =>
        r.ok ? r.json() : { games: [] }
      ),
    ]).then(([g, u, p]) => {
      setGames(g.games || []);
      setVoters(u.users || []);
      setRoulettes(p.games || []);
      setLoading(false);
    });
  }, []);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <main className="col-span-9 p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Statistics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Most Popular Games</h2>
          {games.length === 0 ? (
            <p>No data.</p>
          ) : (
            <table className="min-w-full border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Game</th>
                  <th className="p-2 text-right">Votes</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="p-2">
                      <Link href={`/games/${g.id}`} className="text-purple-600 underline">
                        {g.name}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{g.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Games by Roulette Appearances</h2>
          {roulettes.length === 0 ? (
            <p>No data.</p>
          ) : (
            <table className="min-w-full border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Game</th>
                  <th className="p-2 text-right">Roulettes</th>
                </tr>
              </thead>
              <tbody>
                {roulettes.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="p-2">
                      <Link href={`/games/${g.id}`} className="text-purple-600 underline">
                        {g.name}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{g.roulettes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Top Voters</h2>
          {voters.length === 0 ? (
            <p>No data.</p>
          ) : (
            <table className="min-w-full border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">User</th>
                  <th className="p-2 text-right">Votes</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2">
                      <Link href={`/users/${v.id}`} className="text-purple-600 underline">
                        {v.username}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{v.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
