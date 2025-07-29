"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddGameModal from "@/components/AddGameModal";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { Game } from "@/types";

interface SearchResult {
  rawg_id: number;
  name: string;
  background_image: string | null;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

function NewPollPageContent() {
  const [games, setGames] = useState<Game[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archive, setArchive] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchPoll = async () => {
    if (!backendUrl) return;
    setLoading(true);
    const copyId = searchParams.get("copy");
    const url = copyId
      ? `${backendUrl}/api/poll/${copyId}`
      : `${backendUrl}/api/poll`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      setGames(data.games.map((g: any) => ({ id: g.id, name: g.name })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPoll();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
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

  const handleSelect = async (g: SearchResult) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    const resp = await fetch(`${backendUrl}/api/manage_game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        rawg_id: g.rawg_id,
        name: g.name,
        background_image: g.background_image,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setGames((prev) => [...prev, { id: data.game_id, name: g.name }]);
    }
  };

  const removeGame = (id: number) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
  };

  const createPoll = async () => {
    if (!backendUrl) return;
    const token = session?.access_token;
    setSubmitting(true);
    const resp = await fetch(`${backendUrl}/api/polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        game_ids: games.map((g) => g.id),
        archived: archive,
      }),
    });
    if (resp.ok) {
      router.push(archive ? "/archive" : "/");
    } else {
      setSubmitting(false);
    }
  };

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (!isModerator) return <div className="p-4">Access denied.</div>;

  return (
    <>
      <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">New Roulette</h1>
      <div className="flex items-center space-x-2">
        <label className="text-sm">Add to archive only:</label>
        <input
          type="checkbox"
          checked={archive}
          onChange={(e) => setArchive(e.target.checked)}
        />
      </div>
      {games.length === 0 ? (
          <p>No games selected.</p>
        ) : (
          <ul className="space-y-2">
            {games.map((g) => (
              <li key={g.id} className="flex items-center space-x-2 border p-2 rounded">
                <span className="flex-grow">{g.name}</span>
                <button className="px-2 py-1 bg-gray-300 rounded" onClick={() => removeGame(g.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-x-2">
          <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={() => setShowAdd(true)}>
            Add Game
          </button>
          <button
            className="px-2 py-1 bg-purple-600 text-white rounded disabled:opacity-50"
            onClick={createPoll}
            disabled={games.length === 0 || submitting}
          >
            {submitting ? "Creating..." : "Create roulette"}
          </button>
        </div>
      </main>
      {showAdd && (
        <AddGameModal
          session={session}
          onClose={() => setShowAdd(false)}
          onSelect={(g) => {
            handleSelect(g);
            setShowAdd(false);
          }}
        />
      )}
    </>
  );
}

export default function NewPollPage() {
  return (
    <Suspense>
      <NewPollPageContent />
    </Suspense>
  );
}
