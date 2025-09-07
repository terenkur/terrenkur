"use client";

import { use, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import SpinResultModal from "@/components/SpinResultModal";
import type { Poll } from "@/types";
import { proxiedImage, cn } from "@/lib/utils";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivedPollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [rouletteGames, setRouletteGames] = useState<WheelGame[]>([]);
  const [winner, setWinner] = useState<WheelGame | null>(null);
  const [winningChances, setWinningChances] = useState<Record<number, number>>({});
  const [currentChances, setCurrentChances] = useState<Record<number, number>>({});
  const [eliminatedGame, setEliminatedGame] = useState<WheelGame | null>(null);
  const [postSpinGames, setPostSpinGames] = useState<WheelGame[]>([]);
  const [postSpinWinner, setPostSpinWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const [result, setResult] = useState<{
    poll_id: number;
    winner_id?: number | null;
    eliminated_order: number[];
    spin_seed?: string | null;
  } | null>(null);
  const [replaySeed, setReplaySeed] = useState<string | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [replayDisabled, setReplayDisabled] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const computeSpinChances = (
    games: WheelGame[],
    coeff: number,
    zero: number
  ): Record<number, number> => {
    if (games.length === 0) return {};
    const max = games.reduce((m, g) => Math.max(m, g.count), 0);
    const weights = games.map((g) => ({
      id: g.id,
      weight: g.count === 0 ? zero : 1 + coeff * (max - g.count),
    }));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    const map: Record<number, number> = {};
    weights.forEach((w) => {
      map[w.id] = total > 0 ? (w.weight / total) * 100 : 0;
    });
    return map;
  };

  const computeWinningChances = (
    games: WheelGame[],
    coeff: number,
    zero: number
  ): Record<number, number> => {
    if (games.length === 0) return {};
    const memo: Record<string, number> = {};

    const winProb = (targetId: number, remaining: WheelGame[]): number => {
      if (remaining.length === 1) return 1;
      const key = `${targetId}|${remaining
        .map((g) => g.id)
        .sort((a, b) => a - b)
        .join(',')}`;
      if (memo[key] !== undefined) return memo[key];

      const max = remaining.reduce((m, g) => Math.max(m, g.count), 0);
      const weights = remaining.map((g) => ({
        id: g.id,
        weight: g.count === 0 ? zero : 1 + coeff * (max - g.count),
      }));
      const total = weights.reduce((s, w) => s + w.weight, 0);
      let prob = 0;
      for (const { id, weight } of weights) {
        if (id === targetId) continue;
        prob +=
          (weight / total) *
          winProb(targetId, remaining.filter((g) => g.id !== id));
      }
      memo[key] = prob;
      return prob;
    };

    const result: Record<number, number> = {};
    games.forEach((g) => {
      result[g.id] = winProb(g.id, games) * 100;
    });
    return result;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const resp = await fetch(`${backendUrl}/api/poll/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setPoll(data);
        setRouletteGames(data.games);
        setWinner(null);
        const win = computeWinningChances(data.games, 2, 40);
        const cur = computeSpinChances(data.games, 2, 40);
        setWinningChances(win);
        setCurrentChances(cur);
      }
      const res = await fetch(`${backendUrl}/api/poll/${id}/result`);
      if (res.ok) {
        const rdata = await res.json();
        setResult({ ...rdata, eliminated_order: rdata.eliminated_order ?? [] });
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSpinEnd = (game: WheelGame) => {
    setSpinning(false);
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
          setSpinning(true);
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
    if (!result?.spin_seed || !poll) return;
    setRouletteGames(poll.games);
    setWinner(null);
    setReplaySeed(result.spin_seed);
    setIsReplay(true);
    setPostSpinGames([]);
    setPostSpinWinner(null);
    setReplayDisabled(true);
    setShowReset(true);
    setSpinning(true);
  };

  const resetWheel = () => {
    if (!poll) return;
    if (!window.confirm(t("resetWheelConfirm"))) return;
    setRouletteGames(poll.games);
    setWinner(null);
    setReplaySeed(null);
    setIsReplay(false);
    setPostSpinGames([]);
    setPostSpinWinner(null);
    setEliminatedGame(null);
    setShowReset(false);
    setReplayDisabled(false);
    setSpinning(false);
  };

  useEffect(() => {
    if (replaySeed) {
      wheelRef.current?.spin();
    }
  }, [replaySeed]);

  useEffect(() => {
    setCurrentChances(computeSpinChances(rouletteGames, 2, 40));
  }, [rouletteGames]);

  if (!backendUrl) return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  if (loading) return <div className="p-4">{t("loading")}</div>;
  if (!poll) return <div className="p-4">{t("pollNotFound")}</div>;

  return (
    <>
      <main className="col-span-12 md:col-span-9 grid grid-cols-1 md:grid-cols-9 gap-x-2 gap-y-4 max-w-5xl">
        <div className="col-span-12 md:col-span-3 px-2 py-4 space-y-4 overflow-y-auto">
          <Link href="/archive" className="text-purple-600 underline">
            {t("backToArchive")}
          </Link>
          <h1 className="text-2xl font-semibold">
            {t("rouletteFrom", { date: new Date(poll.created_at).toLocaleString() })}
          </h1>
        {result && (
          <div className="space-y-2">
            {result?.winner_id != null && (
              <p className="font-semibold">
                {t("winningGame", { name: poll.games.find((g) => g.id === result?.winner_id)?.name })}
              </p>
            )}
            {result.eliminated_order.length > 0 && (
              <div>
                <p>{t("eliminationOrder")}</p>
                <ol className="list-decimal pl-4">
                  {result.eliminated_order.map((id) => (
                    <li key={id}>{poll.games.find((g) => g.id === id)?.name}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
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
                    <div className="absolute inset-0 bg-black/80 z-0" />
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
                    style={{ backgroundImage: `url(${proxiedImage(game.background_image)})` }}
                  />
                </>
              )}
              <div className="flex items-center space-x-2 relative z-10 text-white w-full text-sm whitespace-nowrap">
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
                <span className="font-mono text-right">
                  {winningChances[game.id]?.toFixed(1) ?? "0"}% /{' '}
                  {currentChances[game.id]?.toFixed(1) ?? "0"}%
                </span>
              </div>
              <ul className="pl-4 list-none relative z-10">
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
        </div>
        <div className="col-span-12 md:col-span-6 px-2 py-4 flex flex-col items-center justify-start">
        {rouletteGames.length > 0 && !winner && (
          <>
            <RouletteWheel
              ref={wheelRef}
              games={rouletteGames}
              onDone={handleSpinEnd}
              spinSeed={replaySeed ?? undefined}
              spinDuration={4}
            />
            <div className="flex gap-2 mt-2">
              {result?.spin_seed && !replayDisabled && (
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded"
                  onClick={handleReplay}
                >
                  {t("replay")}
                </button>
              )}
              {!isReplay && !spinning && (
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded"
                  onClick={() => {
                    setReplayDisabled(true);
                    setShowReset(true);
                    setSpinning(true);
                    wheelRef.current?.spin();
                  }}
                >
                  {t("spin")}
                </button>
              )}
              {showReset && (
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded"
                  onClick={resetWheel}
                >
                  {t("reset")}
                </button>
              )}
            </div>
          </>
        )}
        {winner && (
          <h2 className="text-2xl font-bold">{t("winningGame", { name: winner.name })}</h2>
        )}
        </div>
      </main>
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
