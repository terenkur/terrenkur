"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile } from "@/lib/profile";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/music-queue/YouTubePlayer";
import type { MusicQueueItem } from "@/types";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = parsed.pathname.split("/")[1];
    if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
      id = /^\/(shorts|embed|live)\//.test(parsed.pathname)
        ? parsed.pathname.split("/")[2]
        : parsed.searchParams.get("v");
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

type Finish = { id: MusicQueueItem["id"]; action: "complete" | "skip" };

export default function MusicQueuePlayerPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [linkAccess, setLinkAccess] = useState<{ loaded: boolean; token: string | null }>({ loaded: false, token: null });
  const [current, setCurrent] = useState<MusicQueueItem | null>(null);
  const [hiddenId, setHiddenId] = useState<MusicQueueItem["id"] | null>(null);
  const finishRef = useRef<Finish | null>(null);
  const wakeRef = useRef<() => void>(() => {});
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const readLink = () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      setLinkAccess({ loaded: true, token });
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);

  useEffect(() => {
    if (!linkAccess.loaded || linkAccess.token !== null) return;
    let disposed = false;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (!disposed) setSession(next);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!disposed && !authEventReceived) setSession(data.session);
    }).catch((error) => console.error("Player session unavailable", error));
    return () => { disposed = true; subscription.unsubscribe(); };
  }, [linkAccess.loaded, linkAccess.token]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (!linkAccess.loaded) return;
    if (!backendUrl) {
      console.error("Player: NEXT_PUBLIC_BACKEND_URL is missing");
      return;
    }
    let disposed = false;
    let running = false;
    let rerun = false;
    const playerToken = linkAccess.token;
    let canControl: boolean | null = playerToken !== null || session ? null : false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const request = async (path: string, method = "GET") => {
      // Each request has a deadline, so an unresponsive backend cannot stall the queue forever.
      const timeout = new AbortController();
      const abort = () => timeout.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const deadline = setTimeout(abort, 10000);
      try {
        const response = await fetch(`${backendUrl}/api/music-queue${path}`, {
          method, cache: "no-store", signal: timeout.signal,
          ...(playerToken !== null
            ? { headers: { "X-Music-Player-Token": playerToken } }
            : session ? { headers: { Authorization: `Bearer ${session.access_token}` } } : {}),
        });
        if (!response.ok) throw new Error(`Queue ${method} ${path}: HTTP ${response.status}`);
        return await response.json();
      } finally {
        clearTimeout(deadline);
        controller.signal.removeEventListener("abort", abort);
      }
    };

    // A single serialized worker owns snapshots and mutations. SSE wakes it immediately;
    // periodic reconciliation recovers missed events, failed requests and reconnects.
    const reconcile = async () => {
      if (disposed) return;
      if (running) { rerun = true; return; }
      running = true;
      clearTimeout(timer);
      let failed = false;
      try {
        if (playerToken !== null) {
          // Recheck each cycle so a revoked link stops controlling playback promptly.
          canControl = (await request("/player-access")).canPlay === true;
        } else if (canControl === null && session) {
          const { data, error } = await fetchMyProfile(session);
          if (error) throw error;
          canControl = !!data?.is_moderator;
          if (!canControl) console.info("Player is view-only: player link or moderator access required.");
        }
        if (disposed) return;
        const snapshot = await request("/public");
        if (disposed) return;
        const active: MusicQueueItem | null = snapshot.active || null;
        setCurrent(active);
        if (finishRef.current && finishRef.current.id !== active?.id) finishRef.current = null;
        if (!canControl) return;

        if (active && !extractYoutubeId(active.url)) {
          finishRef.current = { id: active.id, action: "skip" };
          setHiddenId(active.id);
          console.error("Skipping unsupported video URL", active.id);
        }
        const finish = finishRef.current;
        if (active && finish?.id === active.id) {
          await request(`/${active.id}/${finish.action}`, "POST");
          if (!disposed) { finishRef.current = null; rerun = true; }
        } else if (!active && snapshot.autoStart === true && snapshot.queue?.length) {
          await request(`/${snapshot.queue[0].id}/start?automatic=true`, "POST");
          if (!disposed) rerun = true;
        }
      } catch (error) {
        failed = true;
        if (!disposed) console.error("Player queue sync failed; retrying", error);
      } finally {
        running = false;
        if (!disposed) {
          const delay = rerun && !failed ? 0 : 5000;
          rerun = false;
          timer = setTimeout(reconcile, delay);
        }
      }
    };
    const wake = () => { void reconcile(); };
    wakeRef.current = wake;
    const events = new EventSource(`${backendUrl}/api/music-queue/events`);
    events.onopen = wake;
    events.onmessage = wake;
    window.addEventListener("online", wake);
    void reconcile();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      events.close();
      window.removeEventListener("online", wake);
      wakeRef.current = () => {};
    };
  }, [session, linkAccess.loaded, linkAccess.token]);

  const activate = () => {
    // Both operations run directly in the user gesture, without awaiting a request.
    playerRef.current?.play();
    if (!document.fullscreenElement) {
      void surfaceRef.current?.requestFullscreen?.().catch(() => {});
    }
  };
  const finish = (action: Finish["action"]) => {
    if (!current) return;
    finishRef.current = { id: current.id, action };
    setHiddenId(current.id);
    wakeRef.current();
  };
  const videoId = current && current.id !== hiddenId ? extractYoutubeId(current.url) : null;

  return (
    <div
      ref={surfaceRef}
      className="fixed inset-0 z-50 overflow-hidden bg-black outline-none"
      role="button" tabIndex={0} aria-label="Включить воспроизведение на полный экран"
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      <YouTubePlayer
        ref={playerRef} videoId={videoId} playbackKey={current?.id}
        onEnded={() => finish("complete")} onError={() => finish("skip")}
        fillContainer className="pointer-events-none"
      />
    </div>
  );
}
