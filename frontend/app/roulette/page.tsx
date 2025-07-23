"use client";

import { useEffect, useRef, useState } from "react";
import RouletteWheel, { Game, RouletteWheelHandle } from "@/components/RouletteWheel";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function RoulettePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [winner, setWinner] = useState<Game | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);

  const fetchPoll = async () => {
    if (!backendUrl) return;
    const resp = await fetch(`${backendUrl}/api/poll`);
    if (!resp.ok) return;
    const poll = await resp.json();
    setGames(poll.games);
  };

  useEffect(() => {
    fetchPoll();
  }, []);

  const handleSpinEnd = (game: Game) => {
    const remaining = games.filter((g) => g.id !== game.id);
    if (remaining.length === 0) {
      setWinner(game);
    }
    setGames(remaining);
  };

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  return (
    <main className="p-4 flex flex-col items-center space-y-4">
      {games.length > 0 && !winner && (
        <>
          <RouletteWheel ref={wheelRef} games={games} onDone={handleSpinEnd} />
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
    </main>
  );
}
