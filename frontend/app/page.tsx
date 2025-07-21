"use client";

import { supabase } from "@/utils/supabaseClient";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
if (!backendUrl) {
  console.error("NEXT_PUBLIC_BACKEND_URL is not set");
}

interface Game {
  id: number;
  name: string;
  count: number;
  nicknames: string[];
}

interface Poll {
  id: number;
  games: Game[];
}

export default function Home() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  const fetchPoll = async () => {
    setLoading(true);
    const { data: pollData, error: pollError } = await supabase
      .from("polls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError || !pollData) {
      setLoading(false);
      return;
    }

    const { data: games } = await supabase.from("games").select("id, name");
    const { data: votes } = await supabase
      .from("votes")
      .select("game_id, user_id")
      .eq("poll_id", pollData.id);
    const { data: users } = await supabase
      .from("users")
      .select("id, username");

    const userMap =
      users?.reduce((acc: Record<number, string>, u) => {
        acc[u.id] = u.username;
        return acc;
      }, {}) || {};

    const counts: Record<number, number> = {};
    const nicknames: Record<number, string[]> = {};

    votes?.forEach((v) => {
      counts[v.game_id] = (counts[v.game_id] || 0) + 1;
      if (!nicknames[v.game_id]) nicknames[v.game_id] = [];
      const name = userMap[v.user_id];
      if (name) nicknames[v.game_id].push(name);
    });

    const results =
      games?.map((g) => ({
        id: g.id,
        name: g.name,
        count: counts[g.id] || 0,
        nicknames: nicknames[g.id] || [],
      })) || [];

    setPoll({ id: pollData.id, games: results });
    setLoading(false);
  };

  useEffect(() => {
    fetchPoll();
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

  const handleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSelected(null);
  };

  const handleVote = async () => {
    if (!poll || selected === null) return;
    if (!backendUrl) {
      alert("Backend URL not configured");
      return;
    }
    setSubmitting(true);
    const token = session?.access_token;

    const username =
      session?.user.user_metadata.preferred_username ||
      session?.user.user_metadata.name ||
      session?.user.user_metadata.full_name ||
      session?.user.user_metadata.nickname ||
      session?.user.email;

    await fetch(`${backendUrl}/api/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        poll_id: poll.id,
        game_id: selected,
        username,
      }),
    });
    setSelected(null);
    await fetchPoll();
    setSubmitting(false);
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!poll) return <div className="p-4">No poll available.</div>;

  const username =
    session?.user.user_metadata.preferred_username ||
    session?.user.user_metadata.name ||
    session?.user.user_metadata.full_name ||
    session?.user.user_metadata.nickname ||
    session?.user.email;

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Current Poll</h1>
      {session ? (
        <div className="flex items-center space-x-2">
          <p>Logged in as {username}</p>
          <button
            className="px-2 py-1 bg-gray-800 text-white rounded"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      ) : (
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded"
          onClick={handleLogin}
        >
          Login with Twitch
        </button>
      )}
      <ul className="space-y-2">
        {poll.games.map((game) => (
          <li key={game.id} className="border p-2 rounded space-y-1">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="game"
                value={game.id}
                checked={selected === game.id}
                onChange={() => setSelected(game.id)}
              />
              <span>{game.name}</span>
              <span className="font-mono">{game.count}</span>
            </label>
            <ul className="pl-4 list-disc">
              {game.nicknames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <button
        className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
        disabled={selected === null || submitting || !session}
        onClick={handleVote}
      >
        {submitting ? "Voting..." : "Vote"}
      </button>
    </main>
  );
}
