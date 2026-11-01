"use client";

import { fetchMyProfile } from "@/lib/profile";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventSourcePolyfill } from "event-source-polyfill";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { MusicQueueItem } from "@/types";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const HISTORY_LIMIT = 20;
const MIN_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

type EventStreamStatus = "idle" | "connecting" | "open" | "error";

interface UseMusicQueueEventsOptions {
  url: string | null;
  token?: string | null;
  enabled?: boolean;
  onMessage: (data: string) => void;
  onOpen: () => void;
}

function useMusicQueueEvents({
  url,
  token,
  enabled = true,
  onMessage,
  onOpen,
}: UseMusicQueueEventsOptions): EventStreamStatus {
  const [status, setStatus] = useState<EventStreamStatus>("idle");

  useEffect(() => {
    if (!enabled || !url) {
      setStatus("idle");
      return undefined;
    }

    let isActive = true;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let nextDelay = MIN_RECONNECT_DELAY_MS;

    const updateStatus = (next: EventStreamStatus) => {
      if (isActive) {
        setStatus(next);
      }
    };

    const cleanup = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const scheduleReconnect = () => {
      if (!isActive) return;
      const delay = nextDelay;
      reconnectTimeout = window.setTimeout(() => {
        nextDelay = Math.min(nextDelay * 2, MAX_RECONNECT_DELAY_MS);
        connect();
      }, delay);
    };

    const connect = () => {
      if (!isActive || !url) return;
      cleanup();
      updateStatus("connecting");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      eventSource = new EventSourcePolyfill(url, { headers });
      eventSource.onopen = () => {
        nextDelay = MIN_RECONNECT_DELAY_MS;
        updateStatus("open");
        onOpen();
      };
      eventSource.onmessage = (event) => {
        onMessage(event.data);
      };
      eventSource.onerror = () => {
        updateStatus("error");
        cleanup();
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      isActive = false;
      cleanup();
    };
  }, [enabled, url, token, onMessage, onOpen]);

  return status;
}

function getHistoryTimestamp(item: MusicQueueItem): number {
  const dateStr = item.completed_at || item.started_at || item.created_at;
  if (!dateStr) return 0;
  const timestamp = new Date(dateStr).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    if (host.endsWith("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/")) {
        const [, , id] = parsed.pathname.split("/");
        return id || null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function CopyLinkButton({ url }: { url: string }) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement("textarea");
        field.value = url;
        document.body.appendChild(field);
        try {
          field.select();
          if (!document.execCommand("copy")) throw new Error();
        } finally {
          field.remove();
        }
      }
      setFeedback("Скопировано");
    } catch {
      setFeedback("Не удалось скопировать");
    }
  }
  return <button type="button" onClick={copy} aria-live="polite" className="rounded-md border px-3 py-1 text-sm">
    {feedback || t("musicQueueCopyLink")}
  </button>;
}

function MusicQueuePageContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [moderatorChecked, setModeratorChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<MusicQueueItem[]>([]);
  const [current, setCurrent] = useState<MusicQueueItem | null>(null);
  const [history, setHistory] = useState<MusicQueueItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const latestLoad = useRef(0);
  const [completing, setCompleting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const queueVersionRef = useRef(0);
  const { t } = useTranslation();

  const historyDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }),
    []
  );

  const addToHistory = useCallback((item: MusicQueueItem) => {
    setHistory((prev) => {
      const filtered = prev.filter((p) => p.id !== item.id);
      const nextHistory = [item, ...filtered];
      nextHistory.sort((a, b) => getHistoryTimestamp(b) - getHistoryTimestamp(a));
      return nextHistory.slice(0, HISTORY_LIMIT);
    });
  }, []);

  const removeFromHistory = useCallback((id: number) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const loadQueue = useCallback(async () => {
    if (!backendUrl) return;
    if (isModerator && !session) return;
    const requestId = ++latestLoad.current;
    setError(null);
    const requestVersion = queueVersionRef.current;
    try {
      const endpoint = isModerator
        ? `${backendUrl}/api/music-queue/next`
        : `${backendUrl}/api/music-queue/public`;
      const headers =
        isModerator && session
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined;
      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (requestId !== latestLoad.current) return;
      const queue: MusicQueueItem[] = Array.isArray(data.queue)
        ? data.queue
        : [];
      const active: MusicQueueItem | null = data.active || null;
      const historyItems: MusicQueueItem[] = Array.isArray(data.history)
        ? [...data.history]
        : [];
      historyItems.sort((a, b) => getHistoryTimestamp(b) - getHistoryTimestamp(a));
      if (queueVersionRef.current === requestVersion) {
        setAutoStart(data.autoStart === true);
        setHasSnapshot(true);
        setPending(queue);
        setCurrent(active);
        setHistory(historyItems.slice(0, HISTORY_LIMIT));
      } else {
        void loadQueue();
      }
    } catch (err) {
      console.error("Failed to load music queue", err);
      if (requestId === latestLoad.current) setError(t("musicQueueLoadError"));
    } finally {
      if (requestId === latestLoad.current) setLoading(false);
    }
  }, [backendUrl, session, isModerator, t]);

  useEffect(() => {
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
    const checkModerator = async () => {
      setModeratorChecked(false);
      if (!session) {
        setIsModerator(false);
        setModeratorChecked(true);
        return;
      }
      try {
        const { data, error } = await fetchMyProfile(session);
        if (error) {
          console.error("Failed to check moderator status", error);
          setIsModerator(false);
        } else {
          setIsModerator(!!data?.is_moderator);
        }
      } catch (err) {
        console.error("Failed to check moderator status", err);
        setIsModerator(false);
      } finally {
        setModeratorChecked(true);
      }
    };
    checkModerator();
  }, [session]);

  useEffect(() => {
    if (!backendUrl || !moderatorChecked) return;
    if (isModerator && !session) return;
    loadQueue();
  }, [backendUrl, moderatorChecked, isModerator, session, loadQueue]);

  const handleQueueEvent = useCallback(
    (rawEventData: string) => {
      try {
        const payload = JSON.parse(rawEventData) as {
          autoStart?: boolean;
          item?: MusicQueueItem | null;
          previous?: MusicQueueItem | null;
        };
        if (typeof payload.autoStart === "boolean") {
          queueVersionRef.current += 1;
          setAutoStart(payload.autoStart);
        }
        if (payload.item || payload.previous) {
          queueVersionRef.current += 1;
        }
        if (payload.item) {
          const item = payload.item;
          setPending((prev) => {
            const filtered = prev.filter((p) => p.id !== item.id);
            if (item.status === "pending") {
              filtered.push(item);
              filtered.sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              );
            }
            return filtered;
          });
          setCurrent((prev) => {
            if (!prev) {
              return item.status === "in_progress" ? item : prev;
            }
            if (prev.id !== item.id) {
              return prev;
            }
            if (
              item.status === "completed" ||
              item.status === "skipped" ||
              item.status === "pending"
            ) {
              return null;
            }
            return item;
          });
          if (item.status === "completed" || item.status === "skipped") {
            addToHistory(item);
          } else {
            removeFromHistory(item.id);
          }
        } else if (payload.previous) {
          const item = payload.previous;
          setPending((prev) => prev.filter((p) => p.id !== item.id));
          setCurrent((prev) => (prev && prev.id === item.id ? null : prev));
          removeFromHistory(item.id);
        }
      } catch (err) {
        console.error("Failed to parse music queue event", err);
      }
    },
    [addToHistory, removeFromHistory]
  );

  const eventsUrl = backendUrl ? `${backendUrl}/api/music-queue/events` : null;
  const eventsEnabled = Boolean(
    eventsUrl &&
      moderatorChecked &&
      (!isModerator || (isModerator && session?.access_token))
  );
  const eventStreamStatus = useMusicQueueEvents({
    url: eventsUrl,
    token: isModerator ? session?.access_token ?? null : null,
    enabled: eventsEnabled,
    onMessage: handleQueueEvent,
    onOpen: loadQueue,
  });

  const connectionStatusLabel = useMemo(() => {
    switch (eventStreamStatus) {
      case "open":
        return t("musicQueueRealtimeOpen");
      case "error":
        return t("musicQueueRealtimeError");
      case "connecting":
        return t("musicQueueRealtimeConnecting");
      default:
        return t("musicQueueRealtimeIdle");
    }
  }, [eventStreamStatus, t]);

  const connectionStatusIndicatorClass = useMemo(() => {
    switch (eventStreamStatus) {
      case "open":
        return "bg-emerald-500";
      case "error":
        return "bg-destructive animate-pulse";
      case "connecting":
        return "bg-amber-500 animate-pulse";
      default:
        return "bg-muted";
    }
  }, [eventStreamStatus]);

  const currentVideoId = useMemo(
    () => extractYoutubeId(current?.url),
    [current?.url]
  );

  const currentItemUrl = useMemo(() => {
    if (current?.url) return current.url;
    if (currentVideoId) return `https://youtu.be/${currentVideoId}`;
    return null;
  }, [current?.url, currentVideoId]);

  const getItemUrl = useCallback((item: MusicQueueItem) => {
    if (item.url) return item.url;
    const videoId = extractYoutubeId(item.url);
    return videoId ? `https://youtu.be/${videoId}` : null;
  }, []);

  async function changeAutoStart(enabled: boolean) {
    if (!session || !isModerator || savingMode) return;
    setSavingMode(true);
    setActionError(null);
    try {
      const resp = await fetch(`${backendUrl}/api/music-queue/autostart`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!resp.ok) throw new Error();
      setAutoStart(enabled);
    } catch {
      setActionError("Не удалось изменить режим автозапуска. Попробуйте ещё раз.");
    } finally {
      setSavingMode(false);
    }
  }

  const canControlQueue = isModerator && !!session;

  const startNext = useCallback(
    async (target?: MusicQueueItem, automatic = false) => {
      if (!backendUrl || !session || !isModerator || starting || current) return;
      const nextItem = target ?? pending[0];
      if (!nextItem) return;
      setStarting(true);
      setActionError(null);
      try {
        const resp = await fetch(
          `${backendUrl}/api/music-queue/${nextItem.id}/start${automatic ? "?automatic=true" : ""}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          throw new Error(data?.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (data.autoStart === false) setAutoStart(false);
        const item = (data?.item ?? null) as MusicQueueItem | null;
        if (!item) {
          return;
        }
        queueVersionRef.current += 1;
        setCurrent(item);
        setPending((prev) => prev.filter((p) => p.id !== item.id));
        removeFromHistory(item.id);
      } catch (err) {
        console.error("Failed to start music queue item", err);
        setActionError(t("musicQueueStartFailed"));
      } finally {
        setStarting(false);
      }
    },
    [
      backendUrl,
      session,
      isModerator,
      starting,
      current,
      pending,
      t,
      removeFromHistory,
    ]
  );

  const completeCurrent = useCallback(async () => {
    if (!backendUrl || !session || !isModerator || !current || completing) return;
    setCompleting(true);
    setActionError(null);
    try {
      const resp = await fetch(
        `${backendUrl}/api/music-queue/${current.id}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const item = (data?.item ?? null) as MusicQueueItem | null;
      setCurrent(null);
      queueVersionRef.current += 1;
      if (item) {
        addToHistory(item);
      }
    } catch (err) {
      console.error("Failed to complete music queue item", err);
      setActionError(t("musicQueueCompleteFailed"));
    } finally {
      setCompleting(false);
    }
  }, [
    backendUrl,
    session,
    isModerator,
    current,
    completing,
    t,
    addToHistory,
  ]);

  const skipItem = useCallback(
    async (target?: MusicQueueItem) => {
      if (!backendUrl || !session || !isModerator || skipping) return;
      const item = target ?? current ?? pending[0];
      if (!item) return;
      setSkipping(true);
      setActionError(null);
      try {
        const resp = await fetch(
          `${backendUrl}/api/music-queue/${item.id}/skip`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          throw new Error(data?.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const updated = (data?.item ?? null) as MusicQueueItem | null;
        const targetId = updated?.id ?? item.id;
        queueVersionRef.current += 1;
        if (current && current.id === targetId) {
          setCurrent(null);
        }
        setPending((prev) => prev.filter((p) => p.id !== targetId));
        if (updated) {
          addToHistory(updated);
        }
      } catch (err) {
        console.error("Failed to skip music queue item", err);
        setActionError(t("musicQueueSkipFailed"));
      } finally {
        setSkipping(false);
      }
    },
    [
      backendUrl,
      session,
      isModerator,
      current,
      pending,
      skipping,
      t,
      addToHistory,
    ]
  );

  useEffect(() => {
    if (!canControlQueue || !autoStart || savingMode || error || actionError || !hasSnapshot) return;
    if (loading) return;
    if (starting || completing || skipping) return;
    if (current) return;
    if (pending.length === 0) return;
    void startNext(undefined, true);
  }, [
    canControlQueue,
    autoStart, savingMode, error, actionError, hasSnapshot,
    loading,
    starting,
    completing,
    skipping,
    current,
    pending,
    startNext,
  ]);

  if (!backendUrl) {
    return <div className="p-4">{t("backendUrlMissing")}</div>;
  }

  if (loading) {
    return <div className="p-4">{t("loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("musicQueueTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("musicQueueDescription")}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${connectionStatusIndicatorClass}`}
            aria-hidden
          />
          <span>{connectionStatusLabel}</span>
        </div>
      </header>

      {canControlQueue && hasSnapshot && <label className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm">
        <input type="checkbox" checked={autoStart} disabled={savingMode}
          onChange={event => void changeAutoStart(event.target.checked)} />
        Автозапуск следующего трека · {autoStart ? "включён" : "выключен"}
      </label>}

      {error && <div role="alert" className="space-y-2 rounded-md border p-3 text-sm">
        <p>{error}</p>
        <button onClick={() => void loadQueue()} className="rounded border px-3 py-1">{t("retry")}</button>
      </div>}

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {hasSnapshot && <><section className="space-y-3 rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {t("musicQueueCurrentHeading")}
          </h2>
          {canControlQueue ? (
            <button
              className="px-3 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-60"
              onClick={() => void startNext()}
              disabled={
                starting ||
                !!current ||
                pending.length === 0 ||
                completing ||
                skipping
              }
            >
              {starting
                ? t("musicQueueStarting")
                : t("musicQueueStartNext")}
            </button>
          ) : null}
        </div>
        {current ? (
          <div className="space-y-3">
              <div>
                {currentItemUrl ? (
                  <a
                    href={currentItemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-words text-2xl font-semibold hover:underline"
                  >
                    {current.title || t("musicQueueUntitled")}
                  </a>
                ) : (
                  <p className="break-words text-2xl font-semibold">
                    {current.title || t("musicQueueUntitled")}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {t("musicQueueRequestedBy", {
                    name: current.requested_by || t("musicQueueUnknownUser"),
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentItemUrl && (
                  <CopyLinkButton url={currentItemUrl} />
                )}
                {canControlQueue ? (
                  <>
                  <button
                    className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground disabled:opacity-60"
                    onClick={() => void skipItem(current || undefined)}
                    disabled={skipping}
                  >
                    {skipping
                      ? t("musicQueueSkipping")
                      : t("musicQueueSkip")}
                  </button>
                  <button
                    className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground disabled:opacity-60"
                    onClick={() => void completeCurrent()}
                    disabled={completing}
                  >
                    {completing
                      ? t("musicQueueCompleting")
                      : t("musicQueueMarkComplete")}
                  </button>
                </>
              ) : null}
              </div>
            </div>
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
            {pending[0] ? `Следующий трек — ${pending[0].title || t("musicQueueUntitled")}` : t("musicQueueNoActive")}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t("musicQueuePendingHeading")} · {pending.length}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("musicQueueNoPending")}
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item, index) => {
              const itemUrl = getItemUrl(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-md border border-border bg-background p-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">№{index + 1}{index === 0 && " · Следующий"}</p>
                    {itemUrl ? (
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {item.title || t("musicQueueUntitled")}
                      </a>
                    ) : (
                      <p className="font-medium">
                        {item.title || t("musicQueueUntitled")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("musicQueueRequestedBy", {
                        name:
                          item.requested_by || t("musicQueueUnknownUser"),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {itemUrl && (
                      <CopyLinkButton url={itemUrl} />
                    )}
                    {canControlQueue ? (
                      <>
                        <button
                          className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground disabled:opacity-60"
                          onClick={() => {
                            if (!current) {
                              void startNext(item);
                            }
                          }}
                          disabled={!!current || starting}
                        >
                          {t("musicQueueStartFromItem")}
                        </button>
                        <button
                          className="px-3 py-1 rounded-md border border-input text-sm disabled:opacity-60"
                          onClick={() => {
                            if (!skipping) {
                              void skipItem(item);
                            }
                          }}
                          disabled={skipping}
                        >
                          {t("musicQueueSkip")}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t("musicQueueHistoryHeading")}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("musicQueueNoHistory")}
          </p>
        ) : (
          <ul className="space-y-2">
            {(expanded ? history : history.slice(0, 3)).map((item) => {
              const itemUrl = getItemUrl(item);
              const statusText =
                item.status === "completed"
                  ? t("musicQueueHistoryCompleted")
                  : item.status === "skipped"
                  ? t("musicQueueHistorySkipped")
                  : item.status;
              const completedAt =
                item.completed_at || item.started_at || item.created_at;
              const completedDate = completedAt ? new Date(completedAt) : null;
              const formattedTime =
                completedDate && !Number.isNaN(completedDate.getTime())
                  ? historyDateFormatter.format(completedDate)
                  : null;
              return (
                <li
                  key={`history-${item.id}-${item.completed_at ?? item.started_at ?? item.created_at}`}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-md border border-border bg-background p-3"
                >
                  <div>
                    {itemUrl ? (
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {item.title || t("musicQueueUntitled")}
                      </a>
                    ) : (
                      <p className="font-medium">
                        {item.title || t("musicQueueUntitled")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("musicQueueRequestedBy", {
                        name: item.requested_by || t("musicQueueUnknownUser"),
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formattedTime ? `${statusText} · ${formattedTime}` : statusText}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {itemUrl && (
                      <CopyLinkButton url={itemUrl} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {history.length > 3 && <button type="button" aria-expanded={expanded} className="rounded border px-3 py-1 text-sm"
          onClick={() => setExpanded(value => !value)}>
          {expanded ? "Свернуть историю" : `Показать всю историю (${history.length})`}
        </button>}
      </section></>}
    </div>
  );
}

export default function MusicQueuePage() {
  return (
    <Suspense>
      <MusicQueuePageContent />
    </Suspense>
  );
}
