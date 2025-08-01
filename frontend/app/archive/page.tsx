"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface PollInfo {
  id: number;
  created_at: string;
  archived: boolean;
  winnerName?: string | null;
  winnerId?: number | null;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivePage() {
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    if (!backendUrl) return;
    const loadPolls = async () => {
      const res = await fetch(`${backendUrl}/api/polls`);
      if (!res.ok) return;
      const data = await res.json();
      const pollsData = (data.polls || []) as PollInfo[];

      // Fetch mapping of game id to name for winner lookups
      const gameMap: Record<number, string> = {};
      const gamesRes = await fetch(`${backendUrl}/api/games`);
      if (gamesRes.ok) {
        const gdata = await gamesRes.json();
        (gdata.games || []).forEach((g: { id: number; name: string }) => {
          gameMap[g.id] = g.name;
        });
      }

      const withWinners = await Promise.all(
        pollsData.map(async (p) => {
          let winnerName: string | null = null;
          let winnerId: number | null = null;
          const r = await fetch(`${backendUrl}/api/poll/${p.id}/result`);
          if (r.ok) {
            const rdata = await r.json();
            if (rdata.winner_id) {
              winnerId = rdata.winner_id;
              winnerName = gameMap[rdata.winner_id] || null;
            }
          }
          return { ...p, winnerName, winnerId } as PollInfo;
        })
      );

      setPolls(withWinners);
    };

    loadPolls();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, sess) => {
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

  return (
    <main className="col-span-10 p-4 max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Roulette Archive</h1>
      <ul className="space-y-2">
        <li className="border-2 border-purple-600 p-2 rounded-lg bg-purple-50">
          <Link href="/" className="block text-purple-600 underline font-semibold">
            Go to active roulette
          </Link>
        </li>
        {isModerator && (
          <li>
            <Link
              href="/new-poll"
              className="px-2 py-1 bg-purple-600 text-white rounded inline-block"
            >
              New Roulette
            </Link>
          </li>
        )}
        {polls
          .filter((p) => p.archived)
          .map((p) => (
            <li key={p.id} className="border p-2 rounded-lg bg-muted space-y-1">
              <Link href={`/archive/${p.id}`} className="text-purple-600 underline">
                Roulette from {new Date(p.created_at).toLocaleDateString()}
              </Link>
              {p.winnerName && p.winnerId && (
                <Link
                  href={`/games/${p.winnerId}`}
                  className="text-sm text-purple-600 underline"
                >
                  Winner is {p.winnerName}
                </Link>
              )}
            </li>
          ))}
      </ul>
    </main>
  );
}
