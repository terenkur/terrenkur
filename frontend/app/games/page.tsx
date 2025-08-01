"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import AddCatalogGameModal from "@/components/AddCatalogGameModal";
import EditCatalogGameModal from "@/components/EditCatalogGameModal";
import { proxiedImage, cn } from "@/lib/utils";

interface UserRef {
  id: number;
  username: string;
}

interface GameEntry {
  id: number;
  name: string;
  background_image: string | null;
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

  const fetchData = async () => {
    if (!backendUrl) return;
    setLoading(true);
    const resp = await fetch(`${backendUrl}/api/games`);
    if (!resp.ok) {
      setLoading(false);
      return;
    }
    const data = await resp.json();
    setGames(data.games || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
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
    <li
      key={g.id}
      className={cn(
        "border p-2 rounded-lg space-y-1 relative overflow-hidden",
        g.background_image ? "bg-muted" : "bg-gray-800"
      )}
    >
      {g.background_image && (
        <>
          <div className="absolute inset-0 bg-black/60 z-0" />
          <div
            className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
            style={{ backgroundImage: `url(${proxiedImage(g.background_image)})` }}
          />
        </>
      )}
      <div className="flex items-center space-x-2 relative z-10 text-white text-outline">
        <Link href={`/games/${g.id}`} className="flex-grow text-purple-600 underline">
          {g.name}
        </Link>
        {g.rating !== null && <span className="font-mono">{g.rating}/10</span>}
        {g.selection_method && (
          <span className="text-sm text-gray-600">({g.selection_method})</span>
        )}
        {isModerator && (
          <button
            className="text-sm underline text-purple-600"
            onClick={() => setEditingGame(g)}
          >
            Edit
          </button>
        )}
      </div>
      {g.initiators.length > 0 && (
        <div className="text-sm text-gray-700">Initiators: {renderInitiators(g.initiators)}</div>
      )}
    </li>
  );

  return (
    <>
    <main className="col-span-10 p-4 max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Games</h1>
      {isModerator && (
        <button
          className="px-2 py-1 bg-purple-600 text-white rounded"
          onClick={() => setShowAdd(true)}
        >
          Add Game
        </button>
      )}

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
