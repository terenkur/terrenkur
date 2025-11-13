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

export default function MusicQueuePlayerPage() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [moderatorChecked, setModeratorChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<MusicQueueItem[]>([]);
  const [current, setCurrent] = useState<MusicQueueItem | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const loadQueue = useCallback(
    async (withLoading = false) => {
      if (!backendUrl) return;
      if (withLoading) {
        setLoading(true);
      }
      const isPrivileged = !!session && isModerator;
      try {
        const endpoint = isPrivileged
          ? `${backendUrl}/api/music-queue/next`
          : `${backendUrl}/api/music-queue/public`;
        const headers = isPrivileged
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined;
        const resp = await fetch(endpoint, { headers });
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
      } catch (err) {
        console.error("Failed to load music queue", err);
      } finally {
        if (withLoading) {
          setLoading(false);
        }
      }
    },
    [backendUrl, session, isModerator],
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
      setLoading(true);
      setModeratorChecked(false);
      if (!session) {
        setIsModerator(false);
        setModeratorChecked(true);
        return;
      }
      const { data, error: queryError } = await supabase
        .from("users")
        .select("is_moderator")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      if (queryError) {
        console.error("Failed to check moderator status", queryError);
        setIsModerator(false);
        setModeratorChecked(true);
        return;
      }
      const isMod = !!data?.is_moderator;
      setIsModerator(isMod);
      setModeratorChecked(true);
    };
    void checkModerator();
  }, [session]);

  useEffect(() => {
    if (!backendUrl || !moderatorChecked) return;
    void loadQueue(true);
  }, [backendUrl, session, isModerator, moderatorChecked, loadQueue]);

  useEffect(() => {
    if (!backendUrl || !moderatorChecked) return;
    const events =
      session && isModerator
        ? new EventSource(
            `${backendUrl}/api/music-queue/events?access_token=${encodeURIComponent(
              session.access_token,
            )}`,
          )
        : new EventSource(`${backendUrl}/api/music-queue/events`);
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
  }, [backendUrl, session, isModerator, moderatorChecked]);

  const startNext = useCallback(async () => {
    if (!backendUrl || !session || starting || pending.length === 0) return;
    const nextItem = pending[0];
    setStarting(true);
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
    } catch (err) {
      console.error("Failed to start music queue item", err);
    } finally {
      setStarting(false);
    }
  }, [backendUrl, session, starting, pending]);

  const completeCurrent = useCallback(async () => {
    if (!backendUrl || !session || !current || completing) return;
    setCompleting(true);
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
      await loadQueue();
    } catch (err) {
      console.error("Failed to complete music queue item", err);
    } finally {
      setCompleting(false);
    }
  }, [backendUrl, session, current, completing, loadQueue]);

  useEffect(() => {
    if (loading) return;
    if (!current && pending.length > 0 && !starting && !completing) {
      void startNext();
    }
  }, [current, pending, startNext, starting, completing, loading]);

  const handleEnded = useCallback(() => {
    void completeCurrent();
  }, [completeCurrent]);

  const currentVideoId = useMemo(
    () => extractYoutubeId(current?.url),
    [current?.url],
  );

  const statusContainerClass =
    "flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center text-white";

  if (!backendUrl) {
    return (
      <div className={statusContainerClass}>
        <p className="text-lg font-semibold">{t("backendUrlNotConfigured")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={statusContainerClass}>
        <p className="text-lg font-semibold">{t("musicQueuePlayerLoading")}</p>
      </div>
    );
  }

  if (!currentVideoId && pending.length === 0) {
    return (
      <div className={statusContainerClass}>
        <p className="text-lg font-semibold">{t("musicQueuePlayerNoVideo")}</p>
      </div>
    );
  }

  const canControlQueue = !!session && isModerator;

  return (
    <div className="relative h-screen w-screen bg-black">
      {currentVideoId ? (
        <YouTubePlayer videoId={currentVideoId} onEnded={handleEnded} fillContainer />
      ) : null}
      {!canControlQueue ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="rounded-md bg-black/70 px-4 py-2 text-sm text-white">
            {session ? t("musicQueuePlayerNoAccess") : t("musicQueueViewOnlyNotice")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
