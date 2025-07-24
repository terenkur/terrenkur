"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PollInfo {
  id: number;
  created_at: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivePage() {
  const [polls, setPolls] = useState<PollInfo[]>([]);

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/polls`).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setPolls(data.polls || []);
    });
  }, []);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Roulette Archive</h1>
      <Link href="/" className="underline text-purple-600">
        Go to active roulette
      </Link>
      <ul className="space-y-2">
        {polls.slice(1).map((p) => (
          <li key={p.id}>
            <Link href={`/archive/${p.id}`} className="text-purple-600 underline">
              Roulette from {new Date(p.created_at).toLocaleString()}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
