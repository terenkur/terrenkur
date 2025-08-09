"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatsTable, { StatUser } from "@/components/StatsTable";
import { INTIM_LABELS, POCELUY_LABELS } from "@/lib/statLabels";

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

interface TopParticipant {
  id: number;
  username: string;
  roulettes: number;
}

interface StatsResponse {
  stats: Record<string, StatUser[]>;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

function categorizeByPercent(stats: Record<string, StatUser[]>) {
  const categories: Record<string, Record<string, StatUser[]>> = {
    noPercent: {},
    "0": {},
    "69": {},
    "100": {},
  };
  for (const [key, value] of Object.entries(stats)) {
    if (key.endsWith("_0")) categories["0"][key] = value;
    else if (key.endsWith("_69")) categories["69"][key] = value;
    else if (key.endsWith("_100")) categories["100"][key] = value;
    else categories.noPercent[key] = value;
  }
  return categories;
}

const CATEGORY_LABELS: Record<string, string> = {
  noPercent: "Без процентов",
  "0": "0%",
  "69": "69%",
  "100": "100%",
};

export default function StatsPage() {
  const [games, setGames] = useState<PopularGame[]>([]);
  const [voters, setVoters] = useState<TopVoter[]>([]);
  const [roulettes, setRoulettes] = useState<GameRoulette[]>([]);
  const [participants, setParticipants] = useState<TopParticipant[]>([]);
  const [intim, setIntim] = useState<Record<string, StatUser[]>>({});
  const [poceluy, setPoceluy] = useState<Record<string, StatUser[]>>({});
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
      fetch(`${backendUrl}/api/stats/top-roulette-users`).then((r) =>
        r.ok ? r.json() : { users: [] }
      ),
      fetch(`${backendUrl}/api/stats/intim`).then(async (r) =>
        (r.ok ? await r.json() : { stats: {} }) as StatsResponse
      ),
      fetch(`${backendUrl}/api/stats/poceluy`).then(async (r) =>
        (r.ok ? await r.json() : { stats: {} }) as StatsResponse
      ),
    ]).then(([g, u, p, t, i, pc]) => {
      setGames(g.games || []);
      setVoters(u.users || []);
      setRoulettes(p.games || []);
      setParticipants(t.users || []);
      setIntim(i.stats || {});
      setPoceluy(pc.stats || {});
      setLoading(false);
    });
  }, []);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  if (loading) return <div className="p-4">Loading...</div>;
  const intimCategories = categorizeByPercent(intim);
  const poceluyCategories = categorizeByPercent(poceluy);

  return (
    <main className="col-span-9 p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Statistics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Most Popular Games</h2>
          {games.length === 0 ? (
            <p>No data.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
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
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Games by Roulette Appearances</h2>
          {roulettes.length === 0 ? (
            <p>No data.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
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
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Top Voters</h2>
          {voters.length === 0 ? (
            <p>No data.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
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
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">Top Roulette Participants</h2>
          {participants.length === 0 ? (
            <p>No data.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-right">Roulettes</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">
                        <Link href={`/users/${p.id}`} className="text-purple-600 underline">
                          {p.username}
                        </Link>
                      </td>
                      <td className="p-2 text-right">{p.roulettes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <div className="space-y-6">
        {Object.entries(intimCategories).map(([category, stats]) => (
          <details key={`intim-${category}`}>
            <summary className="cursor-pointer font-semibold">
              Интим: {CATEGORY_LABELS[category]}
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              {Object.entries(stats).map(([key, users]) => {
                const list = Array.isArray(users) ? users : [];
                return (
                  <StatsTable
                    key={`intim-${key}`}
                    title={INTIM_LABELS[key] ?? key}
                    rows={list}
                  />
                );
              })}
            </div>
          </details>
        ))}
        {Object.entries(poceluyCategories).map(([category, stats]) => (
          <details key={`poceluy-${category}`}>
            <summary className="cursor-pointer font-semibold">
              Поцелуй: {CATEGORY_LABELS[category]}
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              {Object.entries(stats).map(([key, users]) => {
                const list = Array.isArray(users) ? users : [];
                return (
                  <StatsTable
                    key={`poceluy-${key}`}
                    title={POCELUY_LABELS[key] ?? key}
                    rows={list}
                  />
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
