"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import SettingsModal from "@/components/SettingsModal";
import SpinResultModal from "@/components/SpinResultModal";
import type { Session } from "@supabase/supabase-js";
import type { Game, Poll, Voter } from "@/types";
import { proxiedImage, cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "react-i18next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
if (!backendUrl) {
  console.error("NEXT_PUBLIC_BACKEND_URL is not set");
}




export default function Home() {
  const { t } = useTranslation();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [initialSlots, setInitialSlots] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [voteLimit, setVoteLimit] = useState(1);
  const [usedVotes, setUsedVotes] = useState(0);
  const [actionHint, setActionHint] = useState("");
  const [rouletteGames, setRouletteGames] = useState<WheelGame[]>([]);
  const [winner, setWinner] = useState<WheelGame | null>(null);
  const [weightCoeff, setWeightCoeff] = useState(2);
  const [zeroWeight, setZeroWeight] = useState(40);
  const [spinDuration, setSpinDuration] = useState(4);
  const [winningChances, setWinningChances] = useState<Record<number, number>>({});
  const [currentChances, setCurrentChances] = useState<Record<number, number>>({});
  const [acceptVotes, setAcceptVotes] = useState(true);
  const [allowEdit, setAllowEdit] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [eliminatedGame, setEliminatedGame] = useState<WheelGame | null>(null);
  const [postSpinGames, setPostSpinGames] = useState<WheelGame[]>([]);
  const [postSpinWinner, setPostSpinWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const [elimOrder, setElimOrder] = useState<number[]>([]);
  const [spinSeed, setSpinSeed] = useState<string | null>(null);
  const [officialMode, setOfficialMode] = useState(false);
  const realtimeFetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

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

    const MAX_DP_GAMES = 12;
    if (games.length > MAX_DP_GAMES) {
      // Too many games for exact computation – fall back to Monte Carlo.
      const iterations = 5000;
      const wins: Record<number, number> = {};
      games.forEach((g) => (wins[g.id] = 0));
      for (let k = 0; k < iterations; k++) {
        let remaining = [...games];
        while (remaining.length > 1) {
          const max = remaining.reduce((m, g) => Math.max(m, g.count), 0);
          const weights = remaining.map((g) => ({
            g,
            weight: g.count === 0 ? zero : 1 + coeff * (max - g.count),
          }));
          const total = weights.reduce((s, w) => s + w.weight, 0);
          let r = Math.random() * total;
          for (const { g, weight } of weights) {
            if (r < weight) {
              remaining = remaining.filter((x) => x.id !== g.id);
              break;
            }
            r -= weight;
          }
        }
        wins[remaining[0].id]++;
      }
      const approx: Record<number, number> = {};
      Object.entries(wins).forEach(([id, count]) => {
        approx[Number(id)] = (count / iterations) * 100;
      });
      return approx;
    }

    const n = games.length;
    const ids = games.map((g) => g.id);
    const counts = games.map((g) => g.count);
    const fullMask = (1 << n) - 1;
    const dp: Record<number, number> = { [fullMask]: 1 };
    const winProb: number[] = new Array(n).fill(0);

    for (let mask = fullMask; mask > 0; mask--) {
      const prob = dp[mask];
      if (!prob) continue;

      const remainingIdx: number[] = [];
      let maxCount = -Infinity;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          remainingIdx.push(i);
          if (counts[i] > maxCount) maxCount = counts[i];
        }
      }
      if (remainingIdx.length === 1) {
        winProb[remainingIdx[0]] += prob;
        continue;
      }

      const weights = remainingIdx.map((idx) => ({
        idx,
        weight: counts[idx] === 0 ? zero : 1 + coeff * (maxCount - counts[idx]),
      }));
      const total = weights.reduce((s, w) => s + w.weight, 0);
      for (const { idx, weight } of weights) {
        const nextMask = mask & ~(1 << idx);
        dp[nextMask] = (dp[nextMask] ?? 0) + prob * (weight / total);
      }
    }

    const result: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      result[ids[i]] = winProb[i] * 100;
    }
    return result;
  };

  const showReset = spinSeed !== null || elimOrder.length > 0 || winner !== null;

  const resetWheel = async () => {
    if (!poll) return;
    const confirmReset = window.confirm(t('resetWheelConfirm'));
    if (!confirmReset) return;

    if (officialMode && isModerator && backendUrl) {
      const token = session?.access_token;
      await fetch(`${backendUrl}/api/poll/${poll.id}/result`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    }

    setRouletteGames(poll.games);
    setWinner(null);
    setElimOrder([]);
    setSpinSeed(null);
    setPostSpinGames([]);
    setPostSpinWinner(null);
    setEliminatedGame(null);
  };

  const sendResult = async (winnerId: number) => {
    if (!backendUrl || !isModerator || !poll) return null;
    const token = session?.access_token;
    return fetch(`${backendUrl}/api/poll/${poll.id}/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        winner_id: winnerId,
        eliminated_order: elimOrder,
        spin_seed: spinSeed ?? undefined,
      }),
    });
  };

  if (!backendUrl) {
    return <div className="p-4">{t('backendUrlNotConfigured')}</div>;
  }

  const fetchPoll = async () => {
    setLoading(true);
    const resp = await fetch(`${backendUrl}/api/poll`);
    if (!resp.ok) {
      setLoading(false);
      return;
    }
    const pollRes = await resp.json();
    const pollData: Poll = {
      id: pollRes.poll_id,
      created_at: pollRes.created_at,
      archived: pollRes.archived,
      games: pollRes.games,
    };

    let coeff = weightCoeff;
    let zero = zeroWeight;
    let duration = spinDuration;

    const [coeffResp, zeroResp, accResp, editResp, durResp] = await Promise.all([
      fetch(`${backendUrl}/api/voice_coeff`),
      fetch(`${backendUrl}/api/zero_vote_weight`),
      fetch(`${backendUrl}/api/accept_votes`),
      fetch(`${backendUrl}/api/allow_edit`),
      fetch(`${backendUrl}/api/spin_duration`),
    ]);

    if (coeffResp.ok) {
      const coeffData = await coeffResp.json();
      coeff = Number(coeffData.coeff);
      setWeightCoeff(coeff);
    }

    if (zeroResp.ok) {
      const zeroData = await zeroResp.json();
      zero = Number(zeroData.weight);
      setZeroWeight(zero);
    }

    if (accResp.ok) {
      const accData = await accResp.json();
      setAcceptVotes(Number(accData.value) !== 0);
    }

    if (editResp.ok) {
      const editData = await editResp.json();
      setAllowEdit(Number(editData.value) !== 0);
    }

    if (durResp.ok) {
      const durData = await durResp.json();
      duration = Number(durData.duration);
      setSpinDuration(duration);
    }

    const { data: votes } = await supabase
      .from("votes")
      .select("game_id, user_id, slot")
      .eq("poll_id", pollRes.poll_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, username, auth_id, vote_limit, is_moderator");

    let limit = 1;
    let used = 0;
    let myVotes: { slot: number; game_id: number }[] = [];
    setIsModerator(false);
    if (session && users) {
      const currentUser = users.find((u) => u.auth_id === session.user.id);
      if (currentUser) {
        limit = currentUser.vote_limit || 1;
        setIsModerator(!!currentUser.is_moderator);
        myVotes =
          votes?.
            filter((v) => v.user_id === currentUser.id)
            .map((v) => ({ slot: v.slot, game_id: v.game_id })) || [];
        used = myVotes.length;
      }
    }
    setVoteLimit(limit);
    setUsedVotes(used);

    const slotArr = Array(limit).fill(null) as (number | null)[];
    myVotes.forEach((v) => {
      if (v.slot - 1 >= 0 && v.slot - 1 < limit) {
        slotArr[v.slot - 1] = v.game_id;
      }
    });
    setSlots(slotArr);
    setInitialSlots(slotArr);

    setPoll(pollData);
    setRouletteGames(pollData.games);
    setWinningChances(computeWinningChances(pollData.games, coeff, zero));
    setCurrentChances(computeSpinChances(pollData.games, coeff, zero));
    setElimOrder([]);
    setSpinSeed(null);
    setWinner(null);
    setLoading(false);
  };

  const fetchPollRef = useRef(fetchPoll);
  useEffect(() => {
    fetchPollRef.current = fetchPoll;
  });

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

  useEffect(() => {
    const channel = supabase.channel("polls");
    const scheduleFetch = () => {
      if (realtimeFetchTimeout.current) return;
      realtimeFetchTimeout.current = setTimeout(() => {
        realtimeFetchTimeout.current = null;
        fetchPollRef.current?.();
      }, 300);
    };

    ["polls", "poll_games", "votes", "settings"].forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          scheduleFetch();
        }
      );
    });

    channel.subscribe();

    return () => {
      if (realtimeFetchTimeout.current) {
        clearTimeout(realtimeFetchTimeout.current);
        realtimeFetchTimeout.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (initialSlots.length === 0) return;
    const currentSelected = slots.filter((s) => s !== null) as number[];
    const originalSelected = initialSlots.filter((s) => s !== null) as number[];
    const added = currentSelected.length > originalSelected.length;
    const removed = currentSelected.length < originalSelected.length;
    const changed =
      !added &&
      !removed &&
      (currentSelected.length !== originalSelected.length ||
        currentSelected.some((v, i) => v !== originalSelected[i]));
    if (added) {
      setActionHint(t('addingVote'));
    } else if (removed) {
      setActionHint(t('removingVote'));
    } else if (changed) {
      setActionHint(t('revoting'));
    } else {
      setActionHint('');
    }
  }, [slots, initialSlots, t]);

  useEffect(() => {
    setCurrentChances(
      computeSpinChances(rouletteGames, weightCoeff, zeroWeight),
    );
  }, [rouletteGames, weightCoeff, zeroWeight]);


  const adjustVote = (gameId: number, delta: number) => {
    if (!acceptVotes) return;
    if (!allowEdit) {
      setActionHint(t('editingDisabled'));
      return;
    }
    setActionHint("");
    setSlots((prev) => {
      const arr = [...prev];
      if (delta > 0) {
        const free = arr.indexOf(null);
        if (free !== -1) {
          arr[free] = gameId;
        } else {
          setActionHint(t('voteLimitReached'));
          return arr;
        }
      } else if (delta < 0) {
        const idx = arr.lastIndexOf(gameId);
        if (idx !== -1) {
          arr[idx] = null;
        }
      }
    return arr;
  });
  };

  const handleSpinEnd = (game: WheelGame) => {
    // Determine games left after removing the selected one
    const remaining = rouletteGames.filter((g) => g.id !== game.id);

    setElimOrder((prev) => [...prev, game.id]);

    // Identify winner if only one game remains (or none left)
    let win: WheelGame | null = null;
    if (remaining.length === 1) {
      win = remaining[0];
    } else if (remaining.length === 0) {
      win = game;
    }

    // Store result for modal display
    setPostSpinGames(remaining);
    setPostSpinWinner(win);
    setEliminatedGame(game);
  };

  const closeResult = async () => {
    setRouletteGames(postSpinGames);
    if (postSpinWinner) {
      setWinner(postSpinWinner);
      if (officialMode && backendUrl && poll) {
        try {
          const resp = await sendResult(postSpinWinner.id);
          if (!resp || !resp.ok) {
            console.error("Failed to record result");
            setEliminatedGame(null);
            return;
          }
          const token = session?.access_token;
          const arch = await fetch(`${backendUrl}/api/polls/${poll.id}/archive`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (arch.ok) {
            router.push(`/new-poll?copy=${poll.id}`);
          } else {
            console.error("Failed to archive poll");
          }
        } catch (err) {
          console.error("Error closing result", err);
        }
      }
    } else {
      setWinner(null);
    }
    setEliminatedGame(null);
  };

  const handleSpin = () => {
    if (!spinSeed) {
      setSpinSeed(Date.now().toString());
    }
    wheelRef.current?.spin();
  };

  const handleVote = async () => {
    if (!poll) return;
    if (!acceptVotes) return;
    if (!allowEdit) return;
    const selected = slots.filter((id) => id !== null) as number[];
    if (selected.length === 0) return;
    if (!backendUrl) {
      alert(t('backendUrlNotConfigured'));
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

    // send concurrent requests for each vote slot
    const requests = [];
    for (let i = 0; i < voteLimit; i++) {
      const gameId = slots[i];
      requests.push(
        fetch(`${backendUrl}/api/vote`, {
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
        })
      );
    }
    await Promise.all(requests);
    setSlots(Array(voteLimit).fill(null));
    await fetchPoll();
    setSubmitting(false);
  };

  const saveCoeff = async (value: number) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/voice_coeff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ coeff: value }),
    });
  };

  const saveZeroWeight = async (value: number) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/zero_vote_weight`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ weight: value }),
    });
  };

  const saveAccept = async (value: boolean) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/accept_votes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ value }),
    });
  };

  const saveAllowEdit = async (value: boolean) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/allow_edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ value }),
    });
  };

  const saveSpinDuration = async (value: number) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/spin_duration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ duration: value }),
    });
  };

  const startOfficialSpin = async () => {
    const confirmStart = window.confirm(t('startOfficialSpinConfirm'));
    if (!confirmStart) return;
    await saveAccept(false);
    await saveAllowEdit(false);
    setAcceptVotes(false);
    setAllowEdit(false);
    setOfficialMode(true);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!poll) return <div className="p-4">{t('noPollAvailable')}</div>;

  return (
    <>
      <main className="col-span-12 md:col-span-9 grid grid-cols-1 md:grid-cols-9 gap-x-2 gap-y-4 max-w-5xl">
        <div className="col-span-12 md:col-span-3 px-2 py-4 space-y-4 overflow-y-auto">
        <h1 className="text-2xl font-semibold">{t('currentPoll')}</h1>
        {isModerator && (
          <div className="space-x-2">
            <button
              className="px-2 py-1 bg-purple-600 text-white rounded"
              onClick={() => setShowSettings(true)}
          >
            {t('settingsModal.title')}
          </button>
          {!officialMode ? (
            <button
              className="px-2 py-1 bg-red-600 text-white rounded"
              onClick={startOfficialSpin}
            >
              {t('startOfficialSpin')}
            </button>
          ) : (
          <span className="px-2 py-1 bg-green-600 text-white rounded">
            {t('officialSpin')}
          </span>
        )}
      </div>
      )}
      <p>{t('castUpToVotes', { count: voteLimit })}</p>
      {!acceptVotes && (
        <p className="text-red-500">{t('votingClosed')}</p>
      )}
      <ul className="space-y-2">
        {poll.games.map((game) => {
          const count = slots.filter((s) => s === game.id).length;
          const totalSelected = slots.filter((s) => s !== null).length;
          return (
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
              <div className="flex items-center space-x-2 relative z-10 text-white w-full">
                <button
                  className="px-2 py-1 bg-gray-300 rounded disabled:opacity-50 font-bold"
                  onClick={() => adjustVote(game.id, -1)}
                  disabled={count === 0 || !acceptVotes || !allowEdit}
                >
                  -
                </button>
                <span>{count}</span>
                <button
                  className="px-2 py-1 bg-gray-300 rounded disabled:opacity-50 font-bold"
                  onClick={() => adjustVote(game.id, 1)}
                  disabled={totalSelected >= voteLimit || !acceptVotes || !allowEdit}
                >
                  +
                </button>
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
          );
        })}
      </ul>
      <button
        className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
        disabled={!slots.some((s) => s !== null) || submitting || !session || !acceptVotes || !allowEdit}
        onClick={handleVote}
      >
        {submitting ? t('voting') : t('vote')}
      </button>
      {actionHint && (
        <p className="text-sm text-gray-500">{actionHint}</p>
      )}
      <p className="text-sm text-gray-500">
        {t('usedVotes', { used: usedVotes, limit: voteLimit })}
      </p>
        </div>
        <div className="col-span-12 md:col-span-6 px-2 py-4 flex flex-col items-center justify-start">
        {rouletteGames.length > 0 && !winner && (
          <>
            <RouletteWheel
              ref={wheelRef}
              games={rouletteGames}
              onDone={handleSpinEnd}
              weightCoeff={weightCoeff}
              zeroWeight={zeroWeight}
              spinSeed={spinSeed ?? undefined}
              spinDuration={spinDuration}
            />
            <div className="flex gap-2 mt-2">
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded"
                onClick={handleSpin}
              >
                {t('spin')}
              </button>
              {showReset && (
                <button
                  className="px-4 py-2 bg-gray-300 rounded"
                  onClick={resetWheel}
                >
                  {t('reset')}
                </button>
              )}
            </div>
          </>
        )}
        {winner && (
          <h2 className="text-2xl font-bold">{t('winningGame', { name: winner.name })}</h2>
        )}
        </div>
      </main>


      {showSettings && (
        <SettingsModal
          coeff={weightCoeff}
          zeroWeight={zeroWeight}
          acceptVotes={acceptVotes}
          allowEdit={allowEdit}
          spinDuration={spinDuration}
          onClose={() => setShowSettings(false)}
          onSave={async (c, z, acc, edit, dur) => {
            await saveCoeff(c);
            await saveZeroWeight(z);
            await saveAccept(acc);
            await saveAllowEdit(edit);
            await saveSpinDuration(dur);
            setWeightCoeff(c);
            setZeroWeight(z);
            setAcceptVotes(acc);
            setAllowEdit(edit);
            setSpinDuration(dur);
            setShowSettings(false);
          }}
        />
      )}
      {eliminatedGame && (
        <SpinResultModal
          eliminated={eliminatedGame}
          winner={postSpinWinner}
          onClose={closeResult}
        />
      )}
    </>
  );
}
