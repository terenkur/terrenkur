"use client";

import { fetchMyProfile } from "@/lib/profile";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import AddCatalogGameModal from "@/components/AddCatalogGameModal";
import EditCatalogGameModal from "@/components/EditCatalogGameModal";
import { proxiedImage, cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DualRange } from "@/components/ui/dual-range";
import { useTranslation } from "react-i18next";

interface UserRef {
  id: number;
  username: string;
}

interface GameEntry {
  id: number;
  name: string;
  background_image: string | null;
  released_year: number | null;
  genres: string[];
  status: string;
  rating: number | null;
  selection_method: string | null;
  initiators: UserRef[];
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function GamesPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingGame, setEditingGame] = useState<GameEntry | null>(null);
  const latestRequest = useRef(0);
  const lastUrl = useRef("");
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const currentYear = new Date().getFullYear();
  const [yearRange, setYearRange] = useState<[number, number]>([
    1980,
    currentYear,
  ]);
  const [ratingRange, setRatingRange] = useState<[number, number]>([1, 10]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const { t } = useTranslation();

  const fetchData = async (retryUrl?: string) => {
    if (!backendUrl) return;
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedStatuses.length)
        params.set("status", selectedStatuses.join(","));
      if (selectedMethods.length)
        params.set("method", selectedMethods.join(","));
      if (selectedGenres.length)
        params.set("genres", selectedGenres.join(","));
      if (yearRange[0] !== 1980) params.set("yearMin", String(yearRange[0]));
      if (yearRange[1] !== currentYear)
        params.set("yearMax", String(yearRange[1]));
      if (ratingRange[0] !== 1)
        params.set("ratingMin", String(ratingRange[0]));
      if (ratingRange[1] !== 10)
        params.set("ratingMax", String(ratingRange[1]));

      const url = retryUrl ?? `${backendUrl}/api/games${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      lastUrl.current = url;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error();
      }
      const data = await resp.json();
      if (request !== latestRequest.current) return;
      setGames(data.games || []);
      if (Array.isArray(data.availableGenres)) {
        setAvailableGenres(data.availableGenres);
      }
    } catch (_) {
      if (request === latestRequest.current) setError(t('failedLoadGames'));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const checkMod = async () => {
      setIsModerator(false);
      if (!session) return;
      const { data } = await fetchMyProfile(session);
      setIsModerator(!!data?.is_moderator);
    };
    checkMod();
  }, [session]);

  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    completed: t('statusCompleted'),
    backlog: t('statusBacklog'),
  };
  const groupedGames = useMemo(() => {
    const groups: Record<string, GameEntry[]> = {
      active: [],
      completed: [],
      backlog: [],
    };
    games.forEach((g) => {
      if (groups[g.status]) {
        groups[g.status].push(g);
      }
    });
    return groups;
  }, [games]);
  const methodLabels: Record<string, string> = {
    donation: t('methodDonation'),
    roulette: t('methodRoulette'),
    points: t('methodPoints'),
  };

  if (!backendUrl) {
    return <div className="p-4">{t('backendUrlMissing')}</div>;
  }

  const renderGame = (g: GameEntry) => (
    <li key={g.id} className="space-y-2 rounded-lg border bg-background p-3 text-foreground">
      <div className="flex items-center gap-3">
        {g.background_image && (
          <img src={proxiedImage(g.background_image) ?? g.background_image}
            alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/games/${g.id}`} className="break-words font-semibold hover:underline">{g.name}</Link>
          {g.released_year && <p className="text-sm text-muted-foreground">{g.released_year}</p>}
        </div>
        {isModerator && <button onClick={() => setEditingGame(g)} className="text-sm underline">{t('edit')}</button>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {g.genres?.length > 0 && <span>{g.genres.join(", ")}</span>}
        {g.rating !== null && <span>{t('rating')}: {g.rating}/10</span>}
        {g.selection_method && <span>{methodLabels[g.selection_method] ?? g.selection_method}</span>}
      </div>
      {g.initiators.length > 0 && (
        <div className="flex flex-wrap gap-x-2 text-sm">
          {t('initiators')}
          {g.initiators.map(user => <Link key={user.id} href={`/users/${user.id}`} className="break-all underline">{user.username}</Link>)}
        </div>
      )}
    </li>
  );

  return (
    <>
    <main className="col-span-12 md:col-span-9 p-4 space-y-6">
      <h1 className="text-2xl font-semibold">{t('gamesTitle')}</h1>
      {isModerator && (
        <button
          className="px-2 py-1 bg-purple-600 text-white rounded"
          onClick={() => setShowAdd(true)}
        >
          {t('addGame')}
        </button>
      )}

      <form role="search" className="flex flex-wrap items-center gap-4" onSubmit={event => { event.preventDefault(); void fetchData(); }}>
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="min-w-0 rounded border bg-background p-2 text-foreground"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <DropdownMenu>
          <DropdownMenuTrigger className="px-2 py-1 border rounded">
            {t('status')}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {"active,completed,backlog".split(",").map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedStatuses((prev) =>
                    prev.includes(s)
                      ? prev.filter((p) => p !== s)
                      : [...prev, s]
                  );
                }}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedStatuses.includes(s)}
                  readOnly
                />
                {statusLabels[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="px-2 py-1 border rounded">
            {t('method')}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {"donation,roulette,points".split(",").map((m) => (
              <DropdownMenuItem
                key={m}
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedMethods((prev) =>
                    prev.includes(m)
                      ? prev.filter((p) => p !== m)
                      : [...prev, m]
                  );
                }}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedMethods.includes(m)}
                  readOnly
                />
                {methodLabels[m]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="px-2 py-1 border rounded">
            {t('genres')}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableGenres.map((g) => (
              <DropdownMenuItem
                key={g}
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedGenres((prev) =>
                    prev.includes(g)
                      ? prev.filter((p) => p !== g)
                      : [...prev, g]
                  );
                }}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedGenres.includes(g)}
                  readOnly
                />
                {g}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="space-y-1">
          <span className="text-sm">{t('year')}</span>
          <DualRange
            min={1980}
            max={currentYear}
            value={yearRange}
            onChange={setYearRange}
          />
        </div>
        <div className="space-y-1">
          <span className="text-sm">{t('rating')}</span>
          <DualRange
            min={1}
            max={10}
            value={ratingRange}
            onChange={setRatingRange}
          />
        </div>
        <button
          className={cn(
            "px-2 py-1 bg-purple-600 text-white rounded",
            loading && "opacity-50 cursor-not-allowed"
          )}
          type="submit"
          disabled={loading}
        >
          {t('search')}
        </button>
      </form>

      <p role="status" className="text-sm text-muted-foreground">
        Найдено игр: {games.length}{loading && " · Обновляем…"}
      </p>
      {error && <div role="alert" className="space-y-2 rounded-lg border p-3">
        <p>{error}</p>
        <button className="rounded border px-3 py-1" onClick={() => fetchData(lastUrl.current)}>{t('retry')}</button>
      </div>}
      <section aria-busy={loading} className="space-y-2">
        {games.length === 0 ? (
          !loading && !error && <p>{t('noGames')}</p>
        ) : (
          <div className="space-y-4">
            {['active', 'completed', 'backlog'].map(
              (status) =>
                groupedGames[status].length > 0 && (
                  <div key={status} className="space-y-2">
                    <h2 className="text-xl font-semibold">
                      {statusLabels[status]}
                    </h2>
                    <ul className="space-y-2">
                      {groupedGames[status].map(renderGame)}
                    </ul>
                  </div>
                )
            )}
          </div>
        )}
      </section>
    </main>
    {showAdd && (
      <AddCatalogGameModal
        session={session}
        onClose={() => setShowAdd(false)}
        onAdded={fetchData}
      />
    )}
    {editingGame && (
      <EditCatalogGameModal
        session={session}
        game={editingGame}
        onClose={() => setEditingGame(null)}
        onUpdated={fetchData}
      />
    )}
    </>
  );
}
