"use client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

import { fetchMyProfile } from "@/lib/profile";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import EventLog from "@/components/EventLog";
import SettingsModal from "@/components/SettingsModal";
import SpinResultModal from "@/components/SpinResultModal";
import type { Session } from "@supabase/supabase-js";
import type { Game, Poll, Voter } from "@/types";
import { proxiedImage } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "react-i18next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
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
  const [rouletteGames, setRouletteGames] = useState<WheelGame[]>([]);
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
  const [postSpinGames, setPostSpinGames] = useState<WheelGame[]>([]);
  const [postSpinWinner, setPostSpinWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const [elimOrder, setElimOrder] = useState<number[]>([]);
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
        setElimOrder([]);
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
      setRouletteGames(pollData.games);
      setElimOrder([]);
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
    if (poll && settingsStatus === 'ready') {
      setWinningChances(computeWinningChances(poll.games, weightCoeff, zeroWeight));
    }
  }, [poll, settingsStatus, weightCoeff, zeroWeight]);

  useEffect(() => {
    setCurrentChances(
      computeSpinChances(rouletteGames, weightCoeff, zeroWeight),
    );
  }, [rouletteGames, weightCoeff, zeroWeight]);


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
    setEliminatedGame(null);
  };

  const handleSpin = () => {
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

  return (
    <>
      <main className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0 space-y-4">
        <h1 className="text-2xl font-semibold">{t('currentPoll')}</h1>
        {settingsStatus === 'failed' && (
          <p role="alert">
            {t('pollSettingsFailed')}{' '}
            <button className="underline" onClick={() => setSettingsVersion(version => version + 1)}>
              {t('retry')}
            </button>
          </p>
        )}
        {isModerator && settingsStatus === 'ready' && (
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
<p className="text-sm text-muted-foreground">Заявки и голоса принимаются через бота на канале.</p>
      {settingsStatus === 'ready' && !acceptVotes && (
        <p className="text-red-500">{t('votingClosed')}</p>
      )}
      <ul className="space-y-2">
        {poll.games.map((game) => {
          return (
            <li
              key={game.id}
              className="space-y-3 rounded-lg border bg-background p-3 text-foreground"
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
              <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-sm tabular-nums">
                  {settingsStatus === 'ready' && <>
                    <dt>{t('pollCard.winChance')}</dt>
                    <dd className="text-right">{winningChances[game.id] === undefined ? '—' :
                      `${poll.games.length > MAX_DP_GAMES ? '≈' : ''}${formatChance.format(winningChances[game.id])}%`}</dd>
                    <dt>{t('pollCard.eliminationChance')}</dt>
                    <dd className="text-right">{currentChances[game.id] === undefined ? '—' :
                      `${formatChance.format(currentChances[game.id])}%`}</dd>
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
        })}
      </ul>

        </div>
        <div className="min-w-0 self-start flex flex-col items-center gap-3 pt-4 md:sticky md:top-4">
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
                disabled={isResetting || settingsStatus !== 'ready' || (officialMode && !isModerator)}
              >
                {t('spin')}
              </button>
              {showReset && settingsStatus === 'ready' && (!officialMode || isModerator) && (
                <button
                  className="px-4 py-2 bg-gray-300 rounded"
                  onClick={resetWheel}
                  disabled={isResetting}
                >
                  {t('reset')}
                </button>
              )}
            </div>
            {resetFailed && <p role="alert">{t('resetWheelFailed')}</p>}
          </>
        )}
        {winner && (
          <h2 className="text-2xl font-bold">{t('winningGame', { name: winner.name })}</h2>
        )}
        <div className="hidden w-full md:block"><EventLog compact /></div>
        </div>
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
