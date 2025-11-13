"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { MusicQueueItem } from "@/types";
import YouTubePlayer, {
  type YouTubePlayerHandle,
} from "@/components/music-queue/YouTubePlayer";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

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

function MusicQueuePageContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<MusicQueueItem[]>([]);
  const [current, setCurrent] = useState<MusicQueueItem | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const { t } = useTranslation();

  const loadQueue = useCallback(async () => {
    if (!backendUrl || !session) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${backendUrl}/api/music-queue/next`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const queue: MusicQueueItem[] = Array.isArray(data.queue)
        ? data.queue
        : [];
      const active: MusicQueueItem | null = data.active || null;
      setPending(queue);
      setCurrent(active);
      setIsPaused(false);
    } catch (err) {
      console.error("Failed to load music queue", err);
      setError(t("musicQueueLoadError"));
    } finally {
      setLoading(false);
    }
  }, [backendUrl, session, t]);

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
      if (!session) {
        setIsModerator(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("is_moderator")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      const isMod = !!data?.is_moderator;
      setIsModerator(isMod);
      if (!isMod) {
        setLoading(false);
      }
    };
    checkModerator();
  }, [session]);

  useEffect(() => {
    if (!backendUrl || !session || !isModerator) return;
    loadQueue();
  }, [session, isModerator, loadQueue]);

  useEffect(() => {
    if (!backendUrl || !session || !isModerator) return;
    const token = encodeURIComponent(session.access_token);
    const events = new EventSource(
      `${backendUrl}/api/music-queue/events?access_token=${token}`
    );
    events.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          item?: MusicQueueItem | null;
          previous?: MusicQueueItem | null;
        };
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
            if (item.status === "completed" || item.status === "skipped") {
              return null;
            }
            return item;
          });
        } else if (payload.previous) {
          const item = payload.previous;
          setPending((prev) => prev.filter((p) => p.id !== item.id));
          setCurrent((prev) => (prev && prev.id === item.id ? null : prev));
        }
      } catch (err) {
        console.error("Failed to parse music queue event", err);
      }
    };
    events.onerror = () => {
      events.close();
    };
    return () => events.close();
  }, [session, isModerator, backendUrl]);

  const currentVideoId = useMemo(
    () => extractYoutubeId(current?.url),
    [current?.url]
  );

  const startNext = useCallback(
    async (target?: MusicQueueItem) => {
      if (!backendUrl || !session || starting || current) return;
      const nextItem = target ?? pending[0];
      if (!nextItem) return;
      setStarting(true);
      setActionError(null);
      try {
        const resp = await fetch(
          `${backendUrl}/api/music-queue/${nextItem.id}/start`,
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
        const item: MusicQueueItem = data.item;
        setCurrent(item);
        setPending((prev) => prev.filter((p) => p.id !== item.id));
        setIsPaused(false);
      } catch (err) {
        console.error("Failed to start music queue item", err);
        setActionError(t("musicQueueStartFailed"));
      } finally {
        setStarting(false);
      }
    },
    [backendUrl, session, starting, current, pending, t]
  );

  const completeCurrent = useCallback(async () => {
    if (!backendUrl || !session || !current || completing) return;
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
      setCurrent(null);
      setIsPaused(false);
    } catch (err) {
      console.error("Failed to complete music queue item", err);
      setActionError(t("musicQueueCompleteFailed"));
    } finally {
      setCompleting(false);
    }
  }, [backendUrl, session, current, completing, t]);

  const skipItem = useCallback(
    async (target?: MusicQueueItem) => {
      if (!backendUrl || !session || skipping) return;
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
        if (current && current.id === item.id) {
          setCurrent(null);
          setIsPaused(false);
        }
        setPending((prev) => prev.filter((p) => p.id !== item.id));
      } catch (err) {
        console.error("Failed to skip music queue item", err);
        setActionError(t("musicQueueSkipFailed"));
      } finally {
        setSkipping(false);
      }
    },
    [backendUrl, session, current, pending, skipping, t]
  );

  useEffect(() => {
    if (!current) {
      setIsPaused(false);
    }
  }, [current]);

  if (!backendUrl) {
    return <div className="p-4">{t("backendUrlMissing")}</div>;
  }

  if (loading) {
    return <div className="p-4">{t("loading")}</div>;
  }

  if (!isModerator) {
    return <div className="p-4">{t("accessDenied")}</div>;
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("musicQueueTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("musicQueueDescription")}
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {t("musicQueueCurrentHeading")}
          </h2>
          <button
            className="px-3 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-60"
            onClick={() => void startNext()}
            disabled={
              starting || !!current || pending.length === 0 || completing || skipping
            }
          >
            {starting
              ? t("musicQueueStarting")
              : t("musicQueueStartNext")}
          </button>
        </div>
        {current ? (
          <div className="space-y-3">
            <YouTubePlayer
              ref={playerRef}
              videoId={currentVideoId}
              onEnded={() => {
                void completeCurrent();
              }}
              onPlaying={() => setIsPaused(false)}
              onPaused={() => setIsPaused(true)}
            />
            <div>
              <p className="text-lg font-medium">
                {current.title || t("musicQueueUntitled")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("musicQueueRequestedBy", {
                  name: current.requested_by || t("musicQueueUnknownUser"),
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentVideoId && (
                <a
                  href={`https://youtu.be/${currentVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-md border border-input text-sm"
                >
                  {t("musicQueueOpenLink")}
                </a>
              )}
              <button
                className="px-3 py-1 rounded-md border border-input text-sm"
                onClick={() => {
                  if (isPaused) {
                    playerRef.current?.play();
                  } else {
                    playerRef.current?.pause();
                  }
                }}
              >
                {isPaused
                  ? t("musicQueueResume")
                  : t("musicQueuePause")}
              </button>
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
            </div>
            {isPaused && (
              <p className="text-xs text-muted-foreground">
                {t("musicQueuePaused")}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
            {t("musicQueueNoActive")}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t("musicQueuePendingHeading")}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("musicQueueNoPending")}
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => {
              const videoId = extractYoutubeId(item.url);
              return (
                <li
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-md border border-border bg-background p-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.title || t("musicQueueUntitled")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("musicQueueRequestedBy", {
                        name:
                          item.requested_by || t("musicQueueUnknownUser"),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {videoId && (
                      <a
                        href={`https://youtu.be/${videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-md border border-input text-sm"
                      >
                        {t("musicQueueOpenLink")}
                      </a>
                    )}
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
