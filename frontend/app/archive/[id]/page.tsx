"use client";

import { use, useEffect, useState, useRef } from "react";
import Link from "next/link";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import SpinResultModal from "@/components/SpinResultModal";
import type { Poll } from "@/types";
import { proxiedImage, cn } from "@/lib/utils";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivedPollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [rouletteGames, setRouletteGames] = useState<WheelGame[]>([]);
  const [winner, setWinner] = useState<WheelGame | null>(null);
  const [eliminatedGame, setEliminatedGame] = useState<WheelGame | null>(null);
  const [postSpinGames, setPostSpinGames] = useState<WheelGame[]>([]);
  const [postSpinWinner, setPostSpinWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const [result, setResult] = useState<{
    poll_id: number;
    winner_id: number | null;
    eliminated_order: number[];
    spin_seed: string | null;
  } | null>(null);
  const [replaySeed, setReplaySeed] = useState<string | null>(null);
  const [isReplay, setIsReplay] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const resp = await fetch(`${backendUrl}/api/poll/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setPoll(data);
        setRouletteGames(data.games);
        setWinner(null);
      }
      const res = await fetch(`${backendUrl}/api/poll/${id}/result`);
      if (res.ok) {
        const rdata = await res.json();
        setResult(rdata);
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSpinEnd = (game: WheelGame) => {
    // Determine games left after removing the selected one
    const remaining = rouletteGames.filter((g) => g.id !== game.id);

    // Identify winner if only one game remains (or none left)
    let win: WheelGame | null = null;
    if (remaining.length === 1) {
      win = remaining[0];
    } else if (remaining.length === 0) {
      win = game;
    }

    if (isReplay) {
      setRouletteGames(remaining);
      if (win) {
        setWinner(win);
        setReplaySeed(null);
        setIsReplay(false);
      } else {
        setWinner(null);
        setTimeout(() => {
          wheelRef.current?.spin();
        }, 2000);
      }
    } else {
      // Store result for modal display
      setPostSpinGames(remaining);
      setPostSpinWinner(win);
      setEliminatedGame(game);
    }
  };

  const closeResult = () => {
    setRouletteGames(postSpinGames);
    if (postSpinWinner) {
      setWinner(postSpinWinner);
    } else {
      setWinner(null);
    }
    setEliminatedGame(null);
  };

  const handleReplay = () => {
    if (!result || !poll) return;
    setRouletteGames(poll.games);
    setWinner(null);
    setReplaySeed(result.spin_seed);
    setIsReplay(true);
    setPostSpinGames([]);
    setPostSpinWinner(null);
  };

  useEffect(() => {
    if (replaySeed) {
      wheelRef.current?.spin();
    }
  }, [replaySeed]);

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!poll) return <div className="p-4">Poll not found.</div>;

  return (
    <>
      <div className="col-span-3 px-2 py-4 space-y-4 overflow-y-auto">
        <Link href="/archive" className="text-purple-600 underline">
          Back to archive
        </Link>
        <h1 className="text-2xl font-semibold">
          Roulette from {new Date(poll.created_at).toLocaleString()}
        </h1>
        {result && (
          <div className="space-y-2">
            {result.winner_id && (
              <p className="font-semibold">
                Winning game: {poll.games.find((g) => g.id === result.winner_id)?.name}
              </p>
            )}
            {result.eliminated_order.length > 0 && (
              <div>
                <p>Elimination order:</p>
                <ol className="list-decimal pl-4">
                  {result.eliminated_order.map((id) => (
                    <li key={id}>{poll.games.find((g) => g.id === id)?.name}</li>
                  ))}
                </ol>
              </div>
            )}
            {result.spin_seed && (
              <button
                className="px-2 py-1 bg-purple-600 text-white rounded"
                onClick={handleReplay}
              >
                Replay
              </button>
            )}
          </div>
        )}
        <ul className="space-y-2">
          {poll.games.map((game) => (
            <li
              key={game.id}
              className={cn(
                "border p-2 rounded-lg space-y-1 relative overflow-hidden",
                game.background_image ? "bg-muted" : "bg-gray-700"
              )}
            >
              {game.background_image && (
                <>
                  <div className="absolute inset-0 bg-black/60 z-0" />
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
                    style={{ backgroundImage: `url(${proxiedImage(game.background_image)})` }}
                  />
                </>
              )}
              <div className="flex items-center space-x-2 relative z-10 text-white">
                <Link
                  href={`/games/${game.id}`}
                  className={cn(
                    "underline",
                    game.background_image ? "text-white" : "text-purple-600"
                  )}
                >
                  {game.name}
                </Link>
                <span className="font-mono ml-auto text-right">{game.count}</span>
              </div>
              <ul className="pl-4 list-disc">
                {game.nicknames.map((voter) => (
                  <li key={voter.id} className="text-white">
                    <span className="text-white">{voter.count}</span>{" "}
                    <Link
                      href={`/users/${voter.id}`}
                      className={cn(
                        "underline",
                        game.background_image ? "text-white" : "text-purple-600"
                      )}
                    >
                      {voter.username}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div className="col-span-7 px-2 py-4 flex flex-col items-center justify-center">
        {rouletteGames.length > 0 && !winner && (
          <>
            <RouletteWheel
              ref={wheelRef}
              games={rouletteGames}
              onDone={handleSpinEnd}
              spinSeed={replaySeed ?? undefined}
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
      {eliminatedGame && !isReplay && (
        <SpinResultModal
          eliminated={eliminatedGame}
          winner={postSpinWinner}
          onClose={closeResult}
        />
      )}
    </>
  );
}
