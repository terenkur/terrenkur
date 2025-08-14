"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatsTable, { StatUser } from "@/components/StatsTable";
import MedalIcon, { MedalType } from "@/components/MedalIcon";
import {
  INTIM_LABELS,
  POCELUY_LABELS,
  TOTAL_LABELS,
  getIntimCategory,
  getPoceluyCategory,
  type StatCategory,
} from "@/lib/statLabels";
import { useTranslation } from "react-i18next";

interface PopularGame {
  id: number;
  name: string;
  votes: number;
}

interface TopVoter {
  id: number;
  username: string;
  votes: number;
  medal?: MedalType | null;
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
  medal?: MedalType | null;
}

interface StatsResponse {
  stats: Record<string, StatUser[]>;
  medals?: Record<string, MedalType | null>;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

type Category = StatCategory;

function categorizeBy(
  stats: Record<string, StatUser[]>,
  getCategory: (key: string) => Category
) {
  const categories: Record<Category, Record<string, StatUser[]>> = {
    none: {},
    "0": {},
    "69": {},
    "100": {},
  };
  for (const [key, value] of Object.entries(stats)) {
    const category = getCategory(key);
    categories[category][key] = value;
  }
  return categories;
}

const CATEGORY_LABELS: Record<Category, string> = {
  none: "Без процентов",
  "0": "0%",
  "69": "69%",
  "100": "100%",
};

export default function StatsPage() {
  const { t } = useTranslation();
  const [games, setGames] = useState<PopularGame[]>([]);
  const [voters, setVoters] = useState<TopVoter[]>([]);
  const [roulettes, setRoulettes] = useState<GameRoulette[]>([]);
  const [participants, setParticipants] = useState<TopParticipant[]>([]);
  const [intim, setIntim] = useState<Record<string, StatUser[]>>({});
  const [poceluy, setPoceluy] = useState<Record<string, StatUser[]>>({});
  const [totals, setTotals] = useState<Record<string, StatUser[]>>({});
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
      fetch(`${backendUrl}/api/stats/totals`).then(async (r) =>
        (r.ok ? await r.json() : { stats: {} }) as StatsResponse
      ),
    ]).then(([g, u, p, t, i, pc, tt]) => {
      setGames(g.games || []);
      setVoters(u.users || []);
      setRoulettes(p.games || []);
      setParticipants(t.users || []);
      setIntim(i.stats || {});
      setPoceluy(pc.stats || {});
      setTotals(tt.stats || {});
      setLoading(false);
    });
  }, []);

  if (!backendUrl) {
    return <div className="p-4">{t('backendUrlNotConfigured')}</div>;
  }

  if (loading) return <div className="p-4">{t('stats.loading')}</div>;
  const intimCategories = categorizeBy(intim, getIntimCategory);
  const poceluyCategories = categorizeBy(poceluy, getPoceluyCategory);

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-6">
      <h1 className="text-2xl font-semibold">{t('stats.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">{t('stats.mostPopularGames')}</h2>
          {games.length === 0 ? (
            <p>{t('stats.noData')}</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">{t('stats.game')}</th>
                    <th className="p-2 text-right">{t('stats.votes')}</th>
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
          <h2 className="text-xl font-semibold mb-2">{t('stats.gamesByRoulette')}</h2>
          {roulettes.length === 0 ? (
            <p>{t('stats.noData')}</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">{t('stats.game')}</th>
                    <th className="p-2 text-right">{t('stats.roulettes')}</th>
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
          <h2 className="text-xl font-semibold mb-2">{t('stats.topVoters')}</h2>
          {voters.length === 0 ? (
            <p>{t('stats.noData')}</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">{t('stats.user')}</th>
                    <th className="p-2 text-right">{t('stats.votes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((v, idx) => {
                    const medal: MedalType | undefined =
                      v.medal ??
                      (idx === 0
                        ? "gold"
                        : idx === 1
                        ? "silver"
                        : idx === 2
                        ? "bronze"
                        : undefined);
                    return (
                      <tr key={v.id} className="border-t">
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <MedalIcon type={medal} />
                            <Link
                              href={`/users/${v.id}`}
                              className="text-purple-600 underline"
                            >
                              {v.username}
                            </Link>
                          </div>
                        </td>
                        <td className="p-2 text-right">{v.votes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold mb-2">{t('stats.topRouletteParticipants')}</h2>
          {participants.length === 0 ? (
            <p>{t('stats.noData')}</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">{t('stats.user')}</th>
                    <th className="p-2 text-right">{t('stats.roulettes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => {
                    const medal: MedalType | undefined =
                      p.medal ??
                      (idx === 0
                        ? "gold"
                        : idx === 1
                        ? "silver"
                        : idx === 2
                        ? "bronze"
                        : undefined);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <MedalIcon type={medal} />
                            <Link
                              href={`/users/${p.id}`}
                              className="text-purple-600 underline"
                            >
                              {p.username}
                            </Link>
                          </div>
                        </td>
                        <td className="p-2 text-right">{p.roulettes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <div className="space-y-6">
        <details>
          <summary className="cursor-pointer text-xl font-semibold">{t('stats.title')}</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            {Object.entries(totals).map(([key, users]) => (
              <StatsTable
                key={`total-${key}`}
                title={TOTAL_LABELS[key] ?? key}
                rows={Array.isArray(users) ? users : []}
              />
            ))}
          </div>
        </details>
        <details>
          <summary className="cursor-pointer text-xl font-semibold">{t('stats.intims')}</summary>
          <div className="space-y-2 mt-2">
            {Object.entries(intimCategories).map(([category, stats]) => (
              <details key={`intim-${category}`}>
                <summary className="cursor-pointer font-semibold">
                  {t('stats.intim')}: {CATEGORY_LABELS[category as Category]}
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
          </div>
        </details>
        <details>
          <summary className="cursor-pointer text-xl font-semibold">{t('stats.kisses')}</summary>
          <div className="space-y-2 mt-2">
            {Object.entries(poceluyCategories).map(([category, stats]) => (
              <details key={`poceluy-${category}`}>
                <summary className="cursor-pointer font-semibold">
                  {t('stats.kiss')}: {CATEGORY_LABELS[category as Category]}
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
        </details>
      </div>
    </main>
  );
}
