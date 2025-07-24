"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import type { Poll } from "@/types";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivedPollPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [rouletteGames, setRouletteGames] = useState<WheelGame[]>([]);
  const [winner, setWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const resp = await fetch(`${backendUrl}/api/poll/${id}`);
      if (!resp.ok) {
        setLoading(false);
        return;
      }
      const data = await resp.json();
      setPoll(data);
      setRouletteGames(data.games);
      setWinner(null);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSpinEnd = (game: WheelGame) => {
    const remaining = rouletteGames.filter((g) => g.id !== game.id);
    if (remaining.length === 0) {
      setWinner(game);
    }
    setRouletteGames(remaining);
  };

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!poll) return <div className="p-4">Poll not found.</div>;

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <Link href="/archive" className="text-purple-600 underline">
        Back to archive
      </Link>
      <h1 className="text-2xl font-semibold">
        Roulette from {new Date(poll.created_at).toLocaleString()}
      </h1>
      <ul className="space-y-2">
        {poll.games.map((game) => (
          <li key={game.id} className="border p-2 rounded space-y-1">
            <div className="flex items-center space-x-2">
              <span>{game.name}</span>
              <span className="font-mono">{game.count}</span>
            </div>
            <ul className="pl-4 list-disc">
              {game.nicknames.map((name, i) => (
                <li key={name + i}>{name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="pt-6 flex flex-col items-center space-y-4">
        {rouletteGames.length > 0 && !winner && (
          <>
            <RouletteWheel
              ref={wheelRef}
              games={rouletteGames}
              onDone={handleSpinEnd}
            />
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded"
              onClick={() => wheelRef.current?.spin()}
            >
              Spin
            </button>
          </>
        )}
        {winner && (
          <h2 className="text-2xl font-bold">Winning game: {winner.name}</h2>
        )}
      </div>
    </main>
  );
}
