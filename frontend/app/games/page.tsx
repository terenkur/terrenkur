"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
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

  const fetchData = async () => {
    if (!backendUrl) return;
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

      const url = `${backendUrl}/api/games${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const resp = await fetch(url);
      if (!resp.ok) {
        setError(t('failedLoadGames'));
        return;
      }
      const data = await resp.json();
      setGames(data.games || []);
      if (Array.isArray(data.availableGenres)) {
        setAvailableGenres(data.availableGenres);
      }
    } catch (_) {
      setError(t('failedLoadGames'));
    } finally {
      setLoading(false);
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
      const { data } = await supabase
        .from("users")
        .select("is_moderator")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      setIsModerator(!!data?.is_moderator);
    };
    checkMod();
  }, [session]);

  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    completed: t('statusCompleted'),
    backlog: t('statusBacklog'),
  };
  const methodLabels: Record<string, string> = {
    donation: t('methodDonation'),
    roulette: t('methodRoulette'),
    points: t('methodPoints'),
  };

  if (!backendUrl) {
    return <div className="p-4">{t('backendUrlMissing')}</div>;
  }

  if (loading) return <div className="p-4">{t('loading')}</div>;
  if (error) return <div className="p-4">{error}</div>;

  const renderInitiators = (inits: UserRef[], white?: boolean) => (
    <span className="space-x-1">
      {inits.map((u, i) => (
        <Link
          key={u.id}
          href={`/users/${u.id}`}
          className={cn("underline", white ? "text-white" : "text-purple-600")}
        >
          {u.username}
          {i < inits.length - 1 ? "," : ""}
        </Link>
      ))}
    </span>
  );

  const renderGame = (g: GameEntry) => (
    <li
      key={g.id}
      className={cn(
        "border p-2 rounded-lg space-y-1 relative overflow-hidden",
        g.background_image ? "bg-muted" : "bg-gray-700"
      )}
    >
        {g.background_image && (
          <>
            <div className="absolute inset-0 bg-black/80 z-0" />
            <div
              className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
              style={{ backgroundImage: `url(${proxiedImage(g.background_image)})` }}
            />
        </>
      )}
      <div className="flex items-center space-x-2 relative z-10 text-white text-sm whitespace-nowrap">
        <Link
          href={`/games/${g.id}`}
          className={cn(
            "flex-grow underline",
            g.background_image ? "text-white" : "text-purple-600"
          )}
        >
          {g.name}
        </Link>
        {g.released_year && (
          <span className="text-sm">{g.released_year}</span>
        )}
        {g.rating !== null && <span className="font-mono">{g.rating}/10</span>}
        {g.selection_method && (
          <span className="text-sm text-white">
            {methodLabels[g.selection_method] ?? g.selection_method}
          </span>
        )}
        {isModerator && (
          <button
            className={cn(
              "text-sm underline",
              g.background_image ? "text-white" : "text-purple-600"
            )}
            onClick={() => setEditingGame(g)}
          >
            {t('edit')}
          </button>
        )}
        </div>
        {g.initiators.length > 0 && (
          <div className="text-sm text-white">
            {t('initiators')} {renderInitiators(g.initiators, true)}
          </div>
        )}
        {g.genres && g.genres.length > 0 && (
          <div className="text-sm text-white">
            {t('genres')}: {g.genres.join(", ")}
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

      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          className="border p-1 rounded text-black"
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
          onClick={fetchData}
          disabled={loading}
        >
          {t('search')}
        </button>
      </div>

      <section className="space-y-2">
        {games.length === 0 ? (
          <p>{t('noGames')}</p>
        ) : (
          <div className="overflow-x-auto">
            <ul className="space-y-2">{games.map(renderGame)}</ul>
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
