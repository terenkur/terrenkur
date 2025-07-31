"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface PollInfo {
  id: number;
  created_at: string;
  archived: boolean;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivePage() {
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/polls`).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setPolls((data.polls || []) as PollInfo[]);
    });
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
      <Link href="/" className="underline text-purple-600">
        Go to active roulette
      </Link>
      {isModerator && (
        <Link
          href="/new-poll"
          className="px-2 py-1 bg-purple-600 text-white rounded inline-block"
        >
          New Roulette
        </Link>
      )}
      <ul className="space-y-2">
        {polls
          .filter((p) => p.archived)
          .map((p) => (
            <li key={p.id} className="border p-2 rounded-lg bg-muted">
              <Link href={`/archive/${p.id}`} className="text-purple-600 underline">
                Roulette from {new Date(p.created_at).toLocaleString()}
              </Link>
            </li>
          ))}
      </ul>
    </main>
  );
}
