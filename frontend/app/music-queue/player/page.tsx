"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";

import YouTubePlayer from "@/components/music-queue/YouTubePlayer";
import { supabase } from "@/lib/supabase";
import type { MusicQueueItem } from "@/types";

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

function FullscreenMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black p-6 text-center text-white">
      <p className="max-w-2xl text-lg font-medium">{message}</p>
    </div>
  );
}

export default function MusicQueuePlayerPage() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<MusicQueueItem[]>([]);
  const [current, setCurrent] = useState<MusicQueueItem | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const loadQueue = useCallback(
    async (withLoading = false) => {
      if (!backendUrl || !session) return;
      if (withLoading) {
        setLoading(true);
      }
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
        if (withLoading) {
          setLoading(false);
        }
      }
    },
    [backendUrl, session, t],
  );

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
      const { data, error: queryError } = await supabase
        .from("users")
        .select("is_moderator")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      if (queryError) {
        console.error("Failed to check moderator status", queryError);
        setError(t("musicQueueLoadError"));
        setIsModerator(false);
        setLoading(false);
        return;
      }
      const isMod = !!data?.is_moderator;
      setIsModerator(isMod);
      if (!isMod) {
        setLoading(false);
      }
    };
    void checkModerator();
  }, [session, t]);

  useEffect(() => {
    if (!backendUrl || !session || !isModerator) return;
    void loadQueue(true);
  }, [backendUrl, session, isModerator, loadQueue]);

  useEffect(() => {
    if (!backendUrl || !session || !isModerator) return;
    const token = encodeURIComponent(session.access_token);
    const events = new EventSource(
      `${backendUrl}/api/music-queue/events?access_token=${token}`,
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
                  new Date(b.created_at).getTime(),
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
  }, [backendUrl, session, isModerator]);

  const startNext = useCallback(async () => {
    if (!backendUrl || !session || starting || pending.length === 0) return;
    const nextItem = pending[0];
    setStarting(true);
    setError(null);
    try {
      const resp = await fetch(
        `${backendUrl}/api/music-queue/${nextItem.id}/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
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
      setError(t("musicQueueStartFailed"));
    } finally {
      setStarting(false);
    }
  }, [backendUrl, session, starting, pending, t]);

  const completeCurrent = useCallback(async () => {
    if (!backendUrl || !session || !current || completing) return;
    setCompleting(true);
    setError(null);
    try {
      const resp = await fetch(
        `${backendUrl}/api/music-queue/${current.id}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      setCurrent(null);
      setPending((prev) => prev.filter((item) => item.id !== current.id));
      setIsPaused(false);
      await loadQueue();
    } catch (err) {
      console.error("Failed to complete music queue item", err);
      setError(t("musicQueueCompleteFailed"));
    } finally {
      setCompleting(false);
    }
  }, [backendUrl, session, current, completing, t, loadQueue]);

  useEffect(() => {
    if (loading) return;
    if (!current && pending.length > 0 && !starting && !completing) {
      void startNext();
    }
  }, [current, pending, startNext, starting, completing, loading]);

  const handleEnded = useCallback(() => {
    void completeCurrent();
  }, [completeCurrent]);

  const handlePlaying = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handlePaused = useCallback(() => {
    setIsPaused(true);
  }, []);

  const currentVideoId = useMemo(
    () => extractYoutubeId(current?.url),
    [current?.url],
  );

  if (!backendUrl) {
    return <FullscreenMessage message={t("musicQueueLoadError")} />;
  }

  if (loading) {
    return <FullscreenMessage message={t("musicQueuePlayerLoading")} />;
  }

  if (!session) {
    return <FullscreenMessage message={t("musicQueuePlayerUnauthorized")} />;
  }

  if (!isModerator) {
    return <FullscreenMessage message={t("musicQueuePlayerNoAccess")} />;
  }

  if (!currentVideoId && pending.length === 0) {
    return <FullscreenMessage message={t("musicQueuePlayerNoVideo")} />;
  }

  return (
    <div className="relative h-screen w-screen bg-black">
      {currentVideoId ? (
        <YouTubePlayer
          videoId={currentVideoId}
          onEnded={handleEnded}
          onPlaying={handlePlaying}
          onPaused={handlePaused}
          fillContainer
        />
      ) : (
        <FullscreenMessage message={t("musicQueuePlayerLoading")} />
      )}
      {error ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="rounded bg-red-500/80 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {error}
          </div>
        </div>
      ) : null}
      {isPaused ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
          <div className="rounded bg-yellow-500/80 px-4 py-2 text-sm font-medium text-black shadow-lg">
            {t("musicQueuePaused")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
