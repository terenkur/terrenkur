"use client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

import { fetchMyProfile } from "@/lib/profile";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import EventLog from "@/components/EventLog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SettingsModal from "@/components/SettingsModal";
import SpinResultModal from "@/components/SpinResultModal";
import type { Session } from "@supabase/supabase-js";
import type { Poll, PollGame } from "@/types";
import { proxiedImage } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "react-i18next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
interface EliminatedRound {
  game: PollGame;
  round: number;
  win: number;
  risk: number;
  approximate: boolean;
}

const MAX_DP_GAMES = 12;
const formatChance = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
if (!backendUrl) {
  console.error("NEXT_PUBLIC_BACKEND_URL is not set");
}




export default function Home() {
  const { t } = useTranslation();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [actionHint, setActionHint] = useState("");
  const [rouletteGames, setRouletteGames] = useState<PollGame[]>([]);
  const [winner, setWinner] = useState<WheelGame | null>(null);
  const [weightCoeff, setWeightCoeff] = useState(2);
  const [zeroWeight, setZeroWeight] = useState(40);
  const [spinDuration, setSpinDuration] = useState(4);
  const [winningChances, setWinningChances] = useState<Record<number, number>>({});
  const [currentChances, setCurrentChances] = useState<Record<number, number>>({});
  const [acceptVotes, setAcceptVotes] = useState(true);
  const [allowEdit, setAllowEdit] = useState(true);
  const [moderatorToken, setModeratorToken] = useState<string | null>(null);
  const isModerator = !!session && moderatorToken === session.access_token;
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [settingsVersion, setSettingsVersion] = useState(0);
  const pollRequest = useRef(0);
  const [latestPollId, setLatestPollId] = useState<number | null>(null);
  const [loadingLatestPoll, setLoadingLatestPoll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [eliminatedGame, setEliminatedGame] = useState<WheelGame | null>(null);
  const [postSpinGames, setPostSpinGames] = useState<PollGame[]>([]);
  const [postSpinWinner, setPostSpinWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<EliminatedRound[]>([]);
  const elimOrder = rounds.map(round => round.game.id);
  const [spinning, setSpinning] = useState(false);
  const [startingOdds, setStartingOdds] = useState<{ win: Record<number, number>; approximate: boolean } | null>(null);
  const [previous, setPrevious] = useState<{ win: Record<number, number>; risk: Record<number, number>; approximate: boolean } | null>(null);
  const runningPoll = useRef<number | null>(null);
  const [roundWeights, setRoundWeights] = useState<{ coeff: number; zero: number } | null>(null);
  const roundCoeff = roundWeights?.coeff ?? weightCoeff;
  const roundZero = roundWeights?.zero ?? zeroWeight;
  const clearRounds = () => {
    runningPoll.current = null;
    setRounds([]);
    setPrevious(null);
    setStartingOdds(null);
    setRoundWeights(null);
    setSpinning(false);
    setEliminatedGame(null);
  };
  const [spinSeed, setSpinSeed] = useState<string | null>(null);
  const [officialMode, setOfficialMode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const realtimeFetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const saveOfficialSpinActive = async (value: boolean) => {
    if (!backendUrl) return false;
    const token = session?.access_token;
    const resp = await fetch(`${backendUrl}/api/official_spin_active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ value }),
    });
    return resp.ok;
  };

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

    if (games.length > MAX_DP_GAMES) {
      // Too many games for exact computation – fall back to Monte Carlo.
      const iterations = 5000;
      const groupSizes: Record<number, number> = {};
      const winsByVoteCount: Record<number, number> = {};
      for (const game of games) {
        groupSizes[game.count] = (groupSizes[game.count] ?? 0) + 1;
      }
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
        const votes = remaining[0].count;
        winsByVoteCount[votes] = (winsByVoteCount[votes] ?? 0) + 1;
      }
      const approx: Record<number, number> = {};
      for (const game of games) {
        const groupWins = winsByVoteCount[game.count] ?? 0;
        approx[game.id] = (groupWins / iterations / groupSizes[game.count]) * 100;
      }
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
    if (!poll || isResetting) return;
    const confirmReset = window.confirm(t('resetWheelConfirm'));
    if (!confirmReset) return;

    setResetFailed(false);
    if (officialMode) {
      if (!isModerator || !backendUrl) return;
      const token = session?.access_token;
      setIsResetting(true);
      try {
        const response = await fetchWithTimeout(`${backendUrl}/api/poll/${poll.id}/reset`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error(`Reset failed: ${response.status}`);
      } catch {
        setResetFailed(true);
        return;
      } finally {
        setIsResetting(false);
      }
      setOfficialMode(false);
    }

    setRouletteGames(poll.games);
    setWinner(null);
    clearRounds();
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

  const fetchPoll = async (options?: { skipLoading?: boolean }) => {
    const request = ++pollRequest.current;
    const shouldControlLoading = !options?.skipLoading && !poll;
    if (shouldControlLoading) {
      setLoading(true);
    }
    const fallbackErrorMessage = t('failedToLoadPoll', {
      defaultValue: 'Не удалось загрузить опрос. Попробуйте снова.',
    });

    try {
      const resp = await fetchWithTimeout(`${backendUrl}/api/poll`);
      if (request !== pollRequest.current) return;
      if (resp.status === 404) {
        setPoll(null);
        setRouletteGames([]);
        setWinner(null);
        clearRounds();
        setSpinSeed(null);
        setPostSpinGames([]);
        setPostSpinWinner(null);
        setEliminatedGame(null);
        setError(null);
        return;
      }
      if (!resp.ok) {
        throw new Error(fallbackErrorMessage);
      }
      const pollRes = await resp.json();
      if (request !== pollRequest.current) return;
      const pollData: Poll = {
        id: pollRes.poll_id,
        created_at: pollRes.created_at,
        archived: pollRes.archived,
        games: pollRes.games,
      };

      setPoll(pollData);
      if (runningPoll.current === pollData.id) {
        setError(null);
        return;
      }
      setRouletteGames(pollData.games);
      clearRounds();
      setSpinSeed(null);
      setWinner(null);
      setError(null);
    } catch (err) {
      if (request !== pollRequest.current) return;
      console.error('Failed to fetch poll', err);
      setPoll(null);
      if (err instanceof Error) {
        setError(err.message || fallbackErrorMessage);
      } else {
        setError(fallbackErrorMessage);
      }
    } finally {
      if (request === pollRequest.current) {
        setLoading(false);
      }
    }
  };

  const fetchLatestPollId = async () => {
    if (!backendUrl) return;
    setLoadingLatestPoll(true);
    try {
      const resp = await fetchWithTimeout(`${backendUrl}/api/polls`);
      if (!resp.ok) {
        throw new Error("Failed to fetch polls");
      }
      const data = await resp.json();
      const latest = data?.polls?.[0];
      setLatestPollId(latest?.id ?? null);
    } catch (err) {
      console.error("Failed to fetch latest poll", err);
      setLatestPollId(null);
    } finally {
      setLoadingLatestPoll(false);
    }
  };

  const handleRetry = async () => {
    setError(null);
    setIsRetrying(true);
    try {
      await fetchPoll({ skipLoading: true });
    } finally {
      setIsRetrying(false);
    }
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
    let active = true;
    setModeratorToken(null);
    if (session) {
      fetchMyProfile(session).then(({ data }) => {
        if (active && data?.is_moderator) setModeratorToken(session.access_token);
      });
    }
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    const controller = new AbortController();
    const read = async (path: string, field: string): Promise<number> => {
      const response = await fetchWithTimeout(`${backendUrl}/api/${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      const value = (await response.json())[field];
      if (!Number.isFinite(value)) throw new Error(`Invalid ${path}`);
      return value;
    };
    setSettingsStatus('loading');
    Promise.all([
      read('voice_coeff', 'coeff'), read('zero_vote_weight', 'weight'),
      read('accept_votes', 'value'), read('allow_edit', 'value'),
      read('spin_duration', 'duration'), read('official_spin_active', 'value'),
    ]).then(([coeff, zero, accept, edit, duration, official]) => {
      if (controller.signal.aborted) return;
      setWeightCoeff(coeff);
      setZeroWeight(zero);
      setAcceptVotes(accept !== 0);
      setAllowEdit(edit !== 0);
      setSpinDuration(duration);
      setOfficialMode(official !== 0);
      setSettingsStatus('ready');
    }).catch(() => {
      if (!controller.signal.aborted) setSettingsStatus('failed');
    });
    return () => controller.abort();
  }, [settingsVersion]);

  useEffect(() => {
    if (!poll && isModerator) {
      fetchLatestPollId();
    }
  }, [poll, isModerator]);

  useEffect(() => {
    const channel = supabase.channel("polls");
    const scheduleFetch = () => {
      if (realtimeFetchTimeout.current) return;
      realtimeFetchTimeout.current = setTimeout(() => {
        realtimeFetchTimeout.current = null;
        fetchPollRef.current?.();
      }, 300);
    };

    ["polls", "poll_games", "votes"].forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          scheduleFetch();
        }
      );
    });

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "settings" },
      () => {
        setSettingsStatus('loading');
        setSettingsVersion(version => version + 1);
      }
    );

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
    if (settingsStatus === 'ready' && !roundWeights) {
      setWinningChances(computeWinningChances(rouletteGames, weightCoeff, zeroWeight));
    }
  }, [rouletteGames, settingsStatus, weightCoeff, zeroWeight, roundWeights]);

  useEffect(() => {
    setCurrentChances(
      computeSpinChances(rouletteGames, roundCoeff, roundZero),
    );
  }, [rouletteGames, roundCoeff, roundZero]);


  const handleSpinEnd = (game: WheelGame) => {
    // Determine games left after removing the selected one
    const remaining = rouletteGames.filter((g) => g.id !== game.id);

    setSpinning(false);
    const selected = rouletteGames.find(item => item.id === game.id);
    if (!selected) return;
    setRounds(prev => [...prev, {
      game: selected,
      round: prev.length + 1,
      win: winningChances[game.id],
      risk: currentChances[game.id],
      approximate: rouletteGames.length > MAX_DP_GAMES,
    }]);

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
    setEliminatedGame(null);
    setPrevious({ win: winningChances, risk: currentChances, approximate: rouletteGames.length > MAX_DP_GAMES });
    setRoundWeights(null);
    setRouletteGames(postSpinGames.length ? postSpinGames : rouletteGames);
    if (postSpinWinner) {
      setWinner(postSpinWinner);
      if (officialMode && backendUrl && poll && isModerator) {
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
            const success = await saveOfficialSpinActive(false);
            if (success) {
              setOfficialMode(false);
            }
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
  };

  const handleSpin = () => {
    if (!poll || spinning || eliminatedGame) return;
    runningPoll.current = poll.id;
    if (!startingOdds) {
      setStartingOdds({ win: winningChances, approximate: rouletteGames.length > MAX_DP_GAMES });
    }
    setSpinning(true);
    setRoundWeights({ coeff: weightCoeff, zero: zeroWeight });
    if (!spinSeed) {
      setSpinSeed(Date.now().toString());
    }
    wheelRef.current?.spin();
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
    const result = await saveOfficialSpinActive(true);
    if (result) {
      setOfficialMode(true);
    }
  };

  if (loading) {
    return (
      <div role="status" className="p-4 flex flex-col gap-3 items-center justify-center">
        <Spinner />
        <p className="text-sm text-muted-foreground">Загружаем опрос. Первый запуск сервера может занять немного времени.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 space-y-4">
        <p className="text-red-500">{error}</p>
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {t('retry', { defaultValue: 'Повторить' })}
        </button>
      </div>
    );
  }
  if (!poll) {
    return (
      <div className="p-4 space-y-4">
        <p>{t('noPollAvailable')}</p>
        {isModerator && (
          <div className="space-y-2">
            {loadingLatestPoll && (
              <p className="text-sm text-gray-500">
                {t('loadingLastRoulette')}
              </p>
            )}
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
              onClick={() => {
                if (latestPollId) {
                  router.push(`/new-poll?copy=${latestPollId}`);
                }
              }}
              disabled={!latestPollId}
            >
              {t('createRouletteFromLast')}
            </button>
            {!loadingLatestPoll && !latestPollId && (
              <p className="text-sm text-gray-500">
                {t('noPreviousRoulette')}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const eliminatedRounds = rounds.filter(({ game }) =>
    game.id !== eliminatedGame?.id && game.id !== winner?.id
  ).reverse();

  function renderGameCard(game: PollGame, archived?: EliminatedRound) {
    const win = archived ? archived.win : winningChances[game.id];
    const risk = archived ? archived.risk : currentChances[game.id];
    const approximate = archived?.approximate ?? (rouletteGames.length > MAX_DP_GAMES);
    return (
    <li
      key={game.id}
      id={archived ? undefined : `roulette-game-${game.id}`}
      className={`space-y-3 rounded-lg border bg-background p-3 text-foreground ${winner?.id === game.id ? 'border-amber-400 ring-2 ring-amber-400' : eliminatedGame?.id === game.id ? 'border-rose-400 ring-2 ring-rose-400' : highlightedId === game.id ? 'ring-2 ring-violet-400' : ''}`}
      onPointerEnter={archived ? undefined : () => setHighlightedId(game.id)}
      onPointerLeave={() => setHighlightedId(null)}
      onFocus={archived ? undefined : () => setHighlightedId(game.id)}
      onBlur={() => setHighlightedId(null)}
    >
      <div className="flex items-center gap-3">
        {game.background_image && (
          <img src={proxiedImage(game.background_image) ?? game.background_image}
            alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0">
          <Link href={`/games/${game.id}`} className="break-words font-semibold hover:underline">
            {game.name}
          </Link>
          <p className="text-sm text-muted-foreground">{t('pollCard.votes')}: {game.count}</p>
        </div>
      </div>
      {archived && <p className="text-sm font-semibold">Выбыла в раунде {archived.round}</p>}
      {eliminatedGame?.id === game.id && postSpinWinner?.id !== game.id && (
        <p className="font-semibold">Выбыла в раунде {rounds.length} · риск {formatChance.format(risk)}%</p>
      )}
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-sm tabular-nums">
          {(archived || !winner) && (archived || settingsStatus === 'ready' || roundWeights) && <>
            <dt>{t(archived ? 'pollCard.pastWinChance' : 'pollCard.winChance')}</dt>
            <dd className="text-right">{win === undefined ? '—' :
              `${approximate ? '≈' : ''}${formatChance.format(win)}%`}
              {!archived && previous && previous.win[game.id] !== undefined && formatChance.format(previous.win[game.id]) !== formatChance.format(win) && (
                <small className="block text-muted-foreground">было {previous.approximate ? '≈' : ''}{formatChance.format(previous.win[game.id])}%</small>
              )}
            </dd>
            <dt>{t(archived ? 'pollCard.pastRisk' : 'pollCard.eliminationChance')}</dt>
            <dd className="text-right">{risk === undefined ? '—' :
              `${formatChance.format(risk)}%`}
              {!archived && previous && previous.risk[game.id] !== undefined && formatChance.format(previous.risk[game.id]) !== formatChance.format(risk) && (
                <small className="block text-muted-foreground">было {formatChance.format(previous.risk[game.id])}%</small>
              )}
            </dd>
          </>}
          {startingOdds?.win[game.id] !== undefined && <>
            <dt>{t('pollCard.initialWinChance')}</dt>
            <dd className="text-right">{startingOdds.approximate ? '≈' : ''}{formatChance.format(startingOdds.win[game.id])}%</dd>
          </>}
      </dl>
      {game.nicknames.length > 0 && (
        <details className="border-t pt-2 text-sm">
          <summary className="cursor-pointer">{t('pollCard.voters')}</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {game.nicknames.map((voter) => (
              <li key={voter.id}>
                <Link href={`/users/${voter.id}`} className="underline">{voter.username}</Link>
                {' · '}{voter.count}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
    );
  }

  return (
    <>
      <header className="mb-6 space-y-2 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{t('pollHeader.title')}</h1>
          {settingsStatus === 'ready' && (isModerator || (showReset && !officialMode)) && (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded border px-3 py-2 text-sm">
                {t('wheelControls.menu')} ▾
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isModerator && (
                  <DropdownMenuItem onSelect={() => setShowSettings(true)}>
                    {t('settingsModal.title')}
                  </DropdownMenuItem>
                )}
                {isModerator && !officialMode && (
                  <DropdownMenuItem onSelect={startOfficialSpin}>{t('startOfficialSpin')}</DropdownMenuItem>
                )}
                {showReset && (
                  <DropdownMenuItem onSelect={resetWheel} disabled={isResetting || spinning || !!eliminatedGame}>{t('reset')}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {resetFailed && <p role="alert">{t('resetWheelFailed')}</p>}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm">
          <p>
            {settingsStatus === 'ready' && <>{t(acceptVotes ? 'pollHeader.open' : 'pollHeader.closed')} · </>}
            {t('pollHeader.games', { count: poll.games.length })} ·{' '}
            {t('pollHeader.votes', { count: poll.games.reduce((sum, game) => sum + game.count, 0) })}
          </p>
          <details>
            <summary className="cursor-pointer underline">{t('pollHeader.how')}</summary>
            <p className="mt-2">
              {t('pollHeader.send')} <code>!игра &lt;название&gt;</code>{' '}
              <a className="underline" href="https://www.twitch.tv/terrenkur/chat" target="_blank" rel="noopener noreferrer">
                {t('pollHeader.chat')}
              </a>.
              {poll.games[0] && <> {t('pollHeader.example')} <code>!игра {poll.games[0].name}</code></>}
            </p>
          </details>
        </div>
      </header>
      <main className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-[1fr_auto]">
        <div className="min-w-0 space-y-4 md:row-span-2">
        {settingsStatus === 'failed' && (
          <p role="alert">
            {t('pollSettingsFailed')}{' '}
            <button className="underline" onClick={() => setSettingsVersion(version => version + 1)}>
              {t('retry')}
            </button>
          </p>
        )}
      <h2 className="text-lg font-semibold" aria-live="polite">
        {winner ? 'Победитель' : `${rouletteGames.length === 2 ? 'Финал' : 'В игре'} · ${spinning ? 'Идёт раунд' : 'Раунд'} ${rounds.length + (eliminatedGame ? 0 : 1)} · ${t('pollHeader.games', { count: rouletteGames.length })}`}
      </h2>
      <ul className={rouletteGames.length === 2 ? "grid gap-2 lg:grid-cols-2" : "space-y-2"}>
        {rouletteGames.map(game => renderGameCard(game))}
      </ul>
      {eliminatedRounds.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Выбыли</h2>
          <ol className="space-y-2">
            {eliminatedRounds.map(entry => renderGameCard(entry.game, entry))}
          </ol>
        </section>
      )}

        </div>
        <div className="min-w-0">
        <div className="flex flex-col items-center gap-3 pt-4 md:sticky md:top-4">
        {rouletteGames.length > 0 && !winner && (
          <>
            {settingsStatus === 'ready' && (
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${officialMode ? 'border-violet-500' : 'text-muted-foreground'}`}>
                {officialMode ? 'Официальная рулетка' : 'Пробное вращение'}
              </span>
            )}
            <RouletteWheel
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
              onSelectGame={id => {
                setHighlightedId(id);
                const card = document.getElementById(`roulette-game-${id}`);
                if (!card) return;
                const { top, bottom } = card.getBoundingClientRect();
                if (top < 0 || bottom > document.documentElement.clientHeight) {
                  card.scrollIntoView({
                    block: 'center',
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
                  });
                }
              }}
              ref={wheelRef}
              games={rouletteGames}
              onDone={handleSpinEnd}
              key={poll.id}
              weightCoeff={roundCoeff}
              zeroWeight={roundZero}
              spinSeed={spinSeed ?? undefined}
              spinDuration={spinDuration}
            />
            {eliminatedGame ? (
              <SpinResultModal eliminated={eliminatedGame} winner={postSpinWinner} onClose={closeResult} />
            ) : (
            <div className="flex gap-2 mt-2">
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded"
                onClick={handleSpin}
                disabled={isResetting || spinning || settingsStatus !== 'ready' || (officialMode && !isModerator)}
              >
                {t(officialMode ? 'wheelControls.official' : 'wheelControls.trial')}
              </button>
            </div>
            )}
          </>
        )}
        {winner && (
          <h2 className="rounded-lg border border-amber-400 bg-amber-100 p-4 text-2xl font-bold text-amber-950">{t('winningGame', { name: winner.name })}</h2>
        )}
        </div>
        </div>
        <div className="hidden min-w-0 md:col-start-2 md:block"><EventLog compact /></div>
      </main>


      {showSettings && isModerator && settingsStatus === 'ready' && (
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

    </>
  );
}
