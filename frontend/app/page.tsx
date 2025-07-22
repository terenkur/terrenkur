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
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [voteLimit, setVoteLimit] = useState(1);
  const [usedVotes, setUsedVotes] = useState(0);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  const fetchPoll = async () => {
    setLoading(true);
    const resp = await fetch(`${backendUrl}/api/poll`);
    if (!resp.ok) {
      setLoading(false);
      return;
    }
    const pollRes = await resp.json();
    const pollData = { id: pollRes.poll_id, games: pollRes.games };

    const { data: votes } = await supabase
      .from("votes")
      .select("game_id, user_id, slot")
      .eq("poll_id", pollRes.poll_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, username, auth_id, vote_limit");

    let limit = 1;
    let used = 0;
    if (session && users) {
      const currentUser = users.find((u) => u.auth_id === session.user.id);
      if (currentUser) {
        limit = currentUser.vote_limit || 1;
        used = votes?.filter((v) => v.user_id === currentUser.id).length || 0;
      }
    }
    setVoteLimit(limit);
    setUsedVotes(used);

    setPoll(pollData);
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

  useEffect(() => {
    if (session) {
      fetchPoll();
    }
  }, [session]);

  const handleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSelected([]);
  };

  const handleVote = async () => {
    if (!poll || selected.length === 0) return;
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

    // send one request per selected game using vote slots
    for (let i = 0; i < voteLimit; i++) {
      const gameId = selected[i];
      await fetch(`${backendUrl}/api/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          poll_id: poll.id,
          game_id: gameId ?? null,
          slot: i + 1,
          username,
        }),
      });
    }
    setSelected([]);
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
      <p>You can select up to {voteLimit} games.</p>
      <ul className="space-y-2">
        {poll.games.map((game) => (
          <li key={game.id} className="border p-2 rounded space-y-1">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                value={game.id}
                checked={selected.includes(game.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    if (selected.length < voteLimit) {
                      setSelected([...selected, game.id]);
                    }
                  } else {
                    setSelected(selected.filter((id) => id !== game.id));
                  }
                }}
              />
              <span>{game.name}</span>
              <span className="font-mono">{game.count}</span>
            </label>
            <ul className="pl-4 list-disc">
              {game.nicknames.map((name, i) => (
                <li key={name + i}>{name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <button
        className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
        disabled={selected.length === 0 || submitting || !session}
        onClick={handleVote}
      >
        {submitting ? "Voting..." : "Vote"}
      </button>
      <p className="text-sm text-gray-500">
        You have used {usedVotes} of {voteLimit} votes.
      </p>
    </main>
  );
}
