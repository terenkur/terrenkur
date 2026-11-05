"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicQueueItem } from "@/types";

type Snapshot = {
  active: MusicQueueItem | null;
  queue: MusicQueueItem[];
  history: MusicQueueItem[];
  playback: { paused: boolean; volume: number; muted: boolean; autoStart: boolean;
    online: boolean; state: number; trackId: number | null; failure?: number };
};
const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
const button = "min-h-10 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed";

export default function PlayerControlPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [volume, setVolume] = useState(100);
  const [stalled, setStalled] = useState(false);
  const editingVolume = useRef(false);
  const mutation = useRef(false);
  const version = useRef(0);
  const requestId = useRef(0);

  useEffect(() => {
    const read = () => {
      version.current++;
      setToken(new URLSearchParams(location.hash.slice(1)).get("token"));
      setSnapshot(null); setLoaded(true); setError("");
    };
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const request = useCallback(async (path: string, body?: unknown) => {
    if (!backend) throw new Error("Не настроен адрес сервера");
    if (!token) throw new Error("Откройте панель по ссылке с #token=…");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch(`${backend}/api/music-queue${path}`, {
        method: body === undefined ? "GET" : "POST", cache: "no-store", signal: abort.signal,
        headers: { "X-Music-Player-Token": token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 401 || response.status === 403) throw new Error("Нет доступа. Проверьте токен в ссылке.");
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Сервер недоступен. Повторите попытку.");
      }
      return await response.json();
    } finally { clearTimeout(timer); }
  }, [token]);

  const refresh = useCallback(async () => {
    if (mutation.current) return;
    const id = ++requestId.current;
    const generation = version.current;
    try {
      const data: Snapshot = await request("/control");
      if (id !== requestId.current || generation !== version.current) return;
      setSnapshot(data); setError("");
      if (!editingVolume.current) setVolume(data.playback.volume);
    } catch (e) {
      if (id === requestId.current && generation === version.current) setError(e instanceof Error ? e.message : "Ошибка связи");
    }
  }, [request]);

  useEffect(() => {
    if (!loaded || !token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await refresh(); if (!stopped) timer = setTimeout(poll, 2000); };
    void poll();
    return () => { stopped = true; clearTimeout(timer); requestId.current++; };
  }, [loaded, token, refresh]);

  const command = async (path: string, body: unknown, message = "Команда отправлена") => {
    if (mutation.current) return;
    mutation.current = true; version.current++; setBusy(true); setError(""); setNotice("");
    try {
      await request(path, body);
      setNotice(message);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось выполнить команду"); }
    finally { mutation.current = false; setBusy(false); }
    // A failed mutation may have reached the server; refresh the actual state, without retrying replay.
    const id = ++requestId.current;
    try {
      const data = await request("/control");
      if (id === requestId.current) { setSnapshot(data); setVolume(data.playback.volume); }
    } catch { /* Keep the actionable command error visible. */ }
  };

  const p = snapshot?.playback;
  const disabled = busy || !snapshot || !!error;
  const items = tab === "queue" ? snapshot?.queue : snapshot?.history;
  const failure = p?.online ? p.failure || 0 : 0;
  const status = error ? "Нет связи с сервером" : !p?.online ? "Плеер не подключён"
    : failure ? "Ошибка воспроизведения"
    : p.state === 1 ? "Воспроизводится" : p.state === 2 ? "На паузе"
    : snapshot?.active ? "Ожидание воспроизведения" : "Ожидание заказа";
  const awaiting = !!(p?.online && snapshot?.active && !failure && !error && (Number(p.trackId) !== Number(snapshot.active.id) || (p.paused ? p.state !== 2 && p.state !== 5 : p.state !== 1)));
  useEffect(() => {
    setStalled(false);
    if (!awaiting) return;
    const timeout = setTimeout(() => setStalled(true), 15000);
    return () => clearTimeout(timeout);
  }, [awaiting, snapshot?.active?.id, p?.paused]);
  const failureMessage = failure === 1000
    ? "Не удалось загрузить YouTube API. Проверьте доступ к www.youtube.com из OBS. Плеер повторяет подключение автоматически."
    : failure === 1001 ? "YouTube не отвечает при запуске. Плеер повторяет подключение автоматически. Проверьте доступ к YouTube из OBS."
    : failure === 1002 ? "Браузер источника заблокировал автозапуск. Разрешите воспроизведение со звуком для источника OBS."
    : failure ? `Ошибка YouTube: ${failure}. Проверьте источник видео в OBS.`
    : stalled ? "Плеер на связи, но воспроизведение не подтверждено. Проверьте журнал OBS и доступ к YouTube; обновите источник после восстановления соединения." : "";

  return (
    <main className="min-h-dvh w-full min-w-0 bg-[#11151b] text-slate-100 [color-scheme:dark]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 p-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base font-semibold tracking-tight">Музыка · OBS</h1>
          <span className="flex items-center gap-1.5 text-xs text-slate-400" role="status">
            <span className={`h-1.5 w-1.5 rounded-full ${p?.online && !error ? "bg-emerald-400" : "bg-amber-400"}`} />{status}
          </span>
        </header>
        {loaded && !token ? <p className="rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">Откройте панель по ссылке <code className="break-all">/player/control#token=ВАШ_ТОКЕН</code>. Используйте тот же токен, что у плеера.</p> : null}
        {error ? <div role="alert" className="rounded-lg border border-rose-400/30 p-3 text-sm text-rose-200"><p className="break-words">{error}</p><button className={`${button} mt-2`} onClick={() => void refresh()}>Повторить</button></div> : null}
        {loaded && token && !snapshot && !error ? <p className="text-sm text-slate-400">Подключение…</p> : null}
        <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" aria-label="Управление воспроизведением">
          <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Сейчас играет</p>
            <h2 className="break-words text-sm font-semibold leading-snug">{snapshot?.active?.title || (snapshot?.active ? "Без названия" : "Очередь ожидает заказ")}</h2>
            {snapshot?.active?.requested_by ? <p className="mt-1 break-words text-xs text-slate-400">{snapshot.active.requested_by}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={disabled} className={`${button} px-2 border-emerald-400/30 bg-emerald-400/15 text-emerald-200`} onClick={() => void command("/control/settings", { paused: !p?.paused })}>{p?.paused ? "Продолжить" : "Пауза"}</button>
            <button disabled={disabled || !snapshot?.active} className={`${button} px-2`} onClick={() => void command(`/${snapshot?.active?.id}/skip`, {}, "Трек пропущен")}>Пропустить</button>
          </div>
          {failureMessage ? <p role="alert" className="text-xs text-amber-200">{failureMessage}</p>
            : awaiting ? <p className="text-xs text-amber-200">Ждём подтверждение плеера…</p> : null}
          <div className="flex items-center gap-2">
            <button className={`${button} shrink-0 px-2`} disabled={disabled} aria-pressed={p?.muted || false} aria-label={p?.muted ? "Включить звук" : "Выключить звук"} onClick={() => void command("/control/settings", { muted: !p?.muted })}>{p?.muted ? "Звук выкл." : "Звук вкл."}</button>
            <label className="min-w-0 flex-1 text-xs text-slate-400">Громкость · {volume}%
              <input className="mt-1 block w-full accent-emerald-400" type="range" min="0" max="100" value={volume} disabled={disabled} aria-label="Громкость"
                onChange={e => { editingVolume.current = true; setVolume(Number(e.target.value)); }}
                onPointerUp={e => { editingVolume.current = false; void command("/control/settings", { volume: Number(e.currentTarget.value) }); }}
                onKeyUp={e => { if (editingVolume.current) { editingVolume.current = false; void command("/control/settings", { volume: Number(e.currentTarget.value) }); } }}
                onBlur={e => { if (editingVolume.current) { editingVolume.current = false; void command("/control/settings", { volume: Number(e.currentTarget.value) }); } }} />
            </label>
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-slate-300">Автозапуск очереди<input className="h-4 w-4 accent-emerald-400" type="checkbox" checked={p?.autoStart ?? false} disabled={disabled} onChange={e => void command("/control/settings", { autoStart: e.target.checked })} /></label>
        </section>
        <p role="status" className="min-h-4 text-xs text-slate-400">{busy ? "Отправка…" : notice || "Команды применяются к отдельному источнику /player."}</p>
        <nav className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1" aria-label="Списки песен">
          <button className={`${button} border-0 ${tab === "queue" ? "bg-white/10 text-white" : "text-slate-400"}`} aria-pressed={tab === "queue"} onClick={() => setTab("queue")}>Очередь · {snapshot?.queue.length ?? 0}</button>
          <button className={`${button} border-0 ${tab === "history" ? "bg-white/10 text-white" : "text-slate-400"}`} aria-pressed={tab === "history"} onClick={() => setTab("history")}>История</button>
        </nav>
        {tab === "history" ? <p className="text-xs text-slate-500">Последние 20 песен. Повтор добавляет песню в конец очереди.</p> : null}
        <ol className="space-y-1.5">
          {items?.map((item, index) => <li key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <span className="w-4 shrink-0 text-center text-xs text-slate-500">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="break-words text-xs font-medium leading-relaxed">{item.title || "Без названия"}</p><p className="break-words text-[11px] text-slate-500">{item.requested_by || "Заказ из очереди"}</p></div>
            {tab === "history" ? <button className={`${button} shrink-0 px-2 text-xs`} disabled={disabled} aria-label={`Повторить ${item.title || "песню"}`} onClick={() => void command(`/control/${item.id}/replay`, {}, "Песня добавлена в конец очереди")}>↻ Повтор</button> : null}
          </li>)}
        </ol>
        {snapshot && !items?.length ? <p className="py-5 text-center text-xs text-slate-500">{tab === "queue" ? "Новых заказов пока нет" : "История пока пуста"}</p> : null}
      </div>
    </main>
  );
}
