"use client";

import { use, useEffect, useState, useRef, useMemo } from "react";
import { computeWinningChances, MAX_DP_GAMES } from "@/lib/winningChances";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";

import type { Poll } from "@/types";
import { proxiedImage } from "@/lib/utils";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

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

interface ArchivedResult {
  winner_id?: number | null;
  eliminated_order?: number[] | null;
  spin_seed?: string | null;
}

export default function ArchivedPollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ArchiveEntry key={id} id={id} />;
}

function ArchiveEntry({ id }: { id: string }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "error" | "missing" | "ready">("loading");
  const [poll, setPoll] = useState<Poll | null>(null);
  const [result, setResult] = useState<ArchivedResult | null>(null);
  const [mode, setMode] = useState<"overview" | "replay" | "experiment">("overview");
  const [history, setHistory] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const wheel = useRef<RouletteWheelHandle>(null);

  useEffect(() => {
    if (!backendUrl) return;
    const controller = new AbortController();
    const load = async () => {
      setStatus("loading");
      const url = `${backendUrl}/api/poll/${id}`;
      try {
        const options = { signal: controller.signal };
        const response = await fetch(url, options);
        if (response.status === 404) {
          setStatus("missing");
          return;
        }
        if (!response.ok) throw new Error();
        const data = await response.json();
        const saved = await fetch(`${url}/result`, options);
        if (!saved.ok && saved.status !== 404) throw new Error();
        const outcome = saved.ok ? await saved.json() : null;
        if (!controller.signal.aborted) {
          setPoll(data);
          setResult(outcome);
          setStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    };
    void load();
    return () => controller.abort();
  }, [id, attempt]);

  const winning = useMemo(() => poll ? computeWinningChances(poll.games, 2, 40) : {}, [poll]);
  const remaining = useMemo(() => poll?.games.filter(game => !history.includes(game.id)) ?? [], [poll, history]);
  const chances = computeSpinChances(remaining, 2, 40);
  const recorded = result?.eliminated_order ?? [];
  const official = poll?.games.find(game => game.id === result?.winner_id);
  const finished = mode !== "overview" && remaining.length === 1;
  const canReplay = !!poll?.games.length && (!!result?.spin_seed || (
    !!official && recorded.length === poll.games.length - 1 &&
    new Set(recorded).size === recorded.length &&
    recorded.every(id => id !== official.id && poll.games.some(game => game.id === id))
  ));
  const target = mode === "replay" ? recorded[history.length] : undefined;
  useEffect(() => {
    if ((!spinning && mode !== "replay") || mode === "overview" || remaining.length < 2) return;
    const timer = window.setTimeout(() => wheel.current?.spin(target), mode === "replay" && history.length ? 1000 : 0);
    return () => window.clearTimeout(timer);
  }, [mode, history.length, remaining.length, spinning, target]);

  function start(next: typeof mode) {
    setHistory([]);
    setMode(next);
    setSpinning(next === "experiment");
  }

  const back = <Link href="/archive" className="text-sm underline">{t("backToArchive")}</Link>;
  if (!backendUrl) return <p>{t("backendUrlNotConfigured")}</p>;
  if (status === "loading") return <p role="status">{t("loading")}</p>;
  if (status === "error") return <div className="space-y-3">{back}<p role="alert">{t("archiveLoadFailed")}</p>
    <button onClick={() => setAttempt(n => n + 1)} className="rounded border px-3 py-2">{t("retry")}</button></div>;
  if (!poll) return <div>{back}<p>{t("pollNotFound")}</p></div>;

  const cover = proxiedImage(official?.background_image);
  const primary = "rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700";
  const secondary = "rounded border px-4 py-2 hover:underline";
  const rounds = mode === "overview" ? recorded : mode === "replay"
    ? [...history, ...recorded.slice(history.length)] : history;
  const last = mode === "overview" ? official : finished ? remaining[0] : null;
  return (
    <article className="mx-auto max-w-5xl space-y-5">
      {back}
      <header className="space-y-3 rounded-lg border bg-background p-4">
        <h1 className="text-xl font-semibold">{t("rouletteFrom", { date: new Date(poll.created_at).toLocaleString("ru-RU") })}</h1>
        <p className="text-sm text-muted-foreground">Официальный результат</p>
        {official ? <Link href={`/games/${official.id}`} className="inline-flex items-center gap-3 rounded hover:underline">
          {cover && <img src={cover} alt="" width={96} height={54} className="aspect-video w-24 rounded object-cover" />}
          <strong className="break-words text-lg">{t("winningGame", { name: official.name })}</strong>
        </Link> : <p>Победитель не указан.</p>}
        {mode === "overview" && <div className="flex flex-wrap gap-2">
          {canReplay && <button className={primary} onClick={() => start("replay")}>Посмотреть повтор</button>}
          {poll.games.length > 0 && <button className={secondary} onClick={() => start("experiment")}>Попробовать другой исход</button>}
        </div>}
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="min-w-0 space-y-4 rounded-lg border bg-background p-4">
          <h2 className="text-lg font-semibold">{mode === "experiment" ? "Свободное вращение" : mode === "replay" ? "Повтор розыгрыша" : "Колесо розыгрыша"}</h2>
          {!finished && remaining.length > 0 && <RouletteWheel key={mode} ref={wheel} games={remaining}
            spinSeed={mode === "replay" ? result?.spin_seed ?? undefined : undefined}
            onDone={game => { setHistory(ids => [...ids, game.id]); setSpinning(false); }} />}
          {mode !== "overview" && <div className="space-y-3">
            <p aria-live="polite" className="font-semibold">{finished
              ? t("winningGame", { name: remaining[0].name })
              : `Раунд ${history.length + 1}`}</p>
            {!finished && <details><summary className="cursor-pointer">Шанс выбыть в этом раунде</summary>
              <ul>{remaining.map(game => <li key={game.id}>{game.name} · {chances[game.id].toFixed(1)}%</li>)}</ul>
            </details>}
            <div className="flex flex-wrap gap-2">
              {finished && canReplay && <button className={primary} onClick={() => start("replay")}>Посмотреть ещё раз</button>}
              {finished && <button className={secondary} onClick={() => start("experiment")}>Попробовать другой исход</button>}
              {!finished && mode === "experiment" && !spinning && <button className={primary} onClick={() => setSpinning(true)}>Следующий раунд</button>}
              <button className={secondary} onClick={() => start("overview")}>Вернуться к результату</button>
            </div>
          </div>}
        </section>
        <section className="min-w-0 space-y-3 rounded-lg border bg-background p-4">
          <h2 className="text-lg font-semibold">Ход {mode === "experiment" ? "свободного вращения" : "розыгрыша"}</h2>
          <ol className="space-y-1">
            {rounds.map((id, i) => <li key={i} aria-current={mode === "replay" && i === history.length ? "step" : undefined}
              className="rounded p-2 aria-[current=step]:bg-muted aria-[current=step]:font-semibold">
              Раунд {i + 1} · Выбыла{" "}
              <Link href={`/games/${id}`} className="underline underline-offset-2">
                {poll.games.find(game => game.id === id)?.name ?? `игра №${id}`}
              </Link>
            </li>)}
            {mode !== "overview" && !finished && rounds.length === history.length && <li aria-current="step" className="rounded bg-muted p-2 font-semibold">Раунд {history.length + 1} · Вращение</li>}
          </ol>
          {mode === "overview" && !rounds.length && <p>Порядок выбывания не сохранён.</p>}
          {last && <p className="font-semibold">
            <Link href={`/games/${last.id}`} className="underline underline-offset-2">
              {t("winningGame", { name: last.name })}
            </Link>
          </p>}
        </section>
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Игры и голоса</h2>
        <ul className="space-y-2">
          {poll.games.map(game => (
            <li key={game.id} className={`space-y-3 rounded-lg border bg-background p-3 text-foreground ${game.id === official?.id ? "border-amber-400 ring-2 ring-amber-400" : ""}`}>
              <div className="flex items-center gap-3">
                {game.background_image && (
                  <img src={proxiedImage(game.background_image) ?? game.background_image}
                    alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0">
                  <Link href={`/games/${game.id}`} className="break-words font-semibold hover:underline">
                    {game.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{t("pollCard.votes")}: {game.count}</p>
                </div>
              </div>
              <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-sm tabular-nums">
                <dt>{t("pollCard.initialWinChance")}</dt>
                <dd className="text-right">{poll.games.length > MAX_DP_GAMES && "≈ "}{winning[game.id].toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%</dd>
              </dl>
              {game.nicknames.length > 0 && (
                <details className="border-t pt-2 text-sm">
                  <summary className="cursor-pointer">{t("pollCard.voters")}</summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {game.nicknames.map(voter => (
                      <li key={voter.id}>
                        <Link href={`/users/${voter.id}`} className="underline">{voter.username}</Link>
                        {" · "}{voter.count}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
