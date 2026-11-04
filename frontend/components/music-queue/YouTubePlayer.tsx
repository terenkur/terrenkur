"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
  getState: () => number;
}
interface YouTubePlayerProps {
  videoId: string | null;
  playbackKey?: string | number;
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  onEnded?: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onError?: (code: number) => void;
  fillContainer?: boolean;
  className?: string;
}
interface Player {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  unMute: () => void;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
}
interface PlayerOptions {
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onError: (event: { data: number }) => void;
    onAutoplayBlocked: () => void;
  };
}
declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: PlayerOptions) => Player };
    onYouTubeIframeAPIReady?: () => void;
    _youtubeIframeAPIPromise?: Promise<void>;
  }
}

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (window._youtubeIframeAPIPromise) return window._youtubeIframeAPIPromise;
  window._youtubeIframeAPIPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = window.onYouTubeIframeAPIReady;
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve();
        previous?.();
      }
    };
    const timeout = window.setTimeout(() => finish(new Error("YouTube API timeout")), 15000);
    window.onYouTubeIframeAPIReady = () => finish();
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => finish(new Error("YouTube API unavailable"));
    document.head.appendChild(script);
  }).catch((error) => {
    window._youtubeIframeAPIPromise = undefined;
    throw error;
  });
  return window._youtubeIframeAPIPromise;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(props, ref) {
    const { videoId, playbackKey, paused = false, volume = 100, muted = false, fillContainer = false, className } = props;
    // YouTube replaces only a child of this stable React-owned container.
    const hostRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<Player | null>(null);
    const callbacks = useRef(props);
    const active = useRef(false);
    const playbackRetry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [ready, setReady] = useState(false);
    useEffect(() => { callbacks.current = props; });

    useEffect(() => {
      let cancelled = false;
      let retry: ReturnType<typeof setTimeout>;
      const initialize = async () => {
        try {
          await loadYouTubeApi();
          if (cancelled || !hostRef.current || !window.YT) return;
          const mount = document.createElement("div");
          hostRef.current.replaceChildren(mount);
          playerRef.current = new window.YT.Player(mount, {
            width: "100%", height: "100%",
            playerVars: {
              autoplay: 1, controls: 0, rel: 0, playsinline: 1,
              disablekb: 1, fs: 0, origin: window.location.origin,
            },
            events: {
              onReady: () => { if (!cancelled) setReady(true); },
              onStateChange: ({ data }) => {
                if (cancelled || !active.current) return;
                if (data === 1) {
                  clearTimeout(playbackRetry.current);
                  if (callbacks.current.paused) playerRef.current?.pauseVideo();
                  callbacks.current.onPlaying?.();
                }
                if (data === 2) callbacks.current.onPaused?.();
                if (data === 0) {
                  active.current = false;
                  callbacks.current.onEnded?.();
                }
              },
              onError: ({ data }) => {
                if (cancelled || !active.current) return;
                // Only video-specific errors should advance the queue.
                // Configuration/network failures must not discard all requests.
                if ([2, 100, 101, 150].includes(data)) {
                  active.current = false;
                  callbacks.current.onError?.(data);
                } else if (data === 5) {
                  clearTimeout(playbackRetry.current);
                  playbackRetry.current = setTimeout(() => {
                    const id = callbacks.current.videoId;
                    if (!cancelled && active.current && id) {
                      if (callbacks.current.paused) playerRef.current?.cueVideoById(id);
                      else playerRef.current?.loadVideoById(id);
                    }
                  }, 5000);
                }
                console.error("YouTube playback error", data);
              },
              onAutoplayBlocked: () => {
                console.info("Autoplay blocked; click the player surface to enable playback.");
              },
            },
          });
          const iframe = playerRef.current.getIframe();
          iframe.allow = "autoplay; fullscreen";
          iframe.title = "Видео из очереди";
          iframe.style.cssText = "width:100%;height:100%;border:0";
        } catch (error) {
          console.error("Failed to initialize YouTube", error);
          if (!cancelled) retry = setTimeout(initialize, 5000);
        }
      };
      void initialize();
      return () => {
        cancelled = true;
        clearTimeout(retry);
        clearTimeout(playbackRetry.current);
        active.current = false;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, []);

    useEffect(() => {
      clearTimeout(playbackRetry.current);
      if (!ready || !playerRef.current) return;
      active.current = !!videoId;
      if (videoId) {
        if (callbacks.current.paused) playerRef.current.cueVideoById(videoId);
        else playerRef.current.loadVideoById(videoId);
      }
      else playerRef.current.stopVideo();
    }, [ready, videoId, playbackKey]);

    useEffect(() => {
      if (!ready || !playerRef.current) return;
      const player = playerRef.current;
      player.setVolume(volume);
      if (muted) player.mute(); else player.unMute();
    }, [ready, volume, muted]);

    useEffect(() => {
      if (!ready || !active.current) return;
      if (paused) playerRef.current?.pauseVideo();
      else playerRef.current?.playVideo();
    }, [ready, paused]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (active.current && !callbacks.current.paused) {
          if (!callbacks.current.muted) playerRef.current?.unMute();
          playerRef.current?.playVideo();
        }
      },
      pause: () => playerRef.current?.pauseVideo(),
      stop: () => playerRef.current?.stopVideo(),
      getState: () => playerRef.current?.getPlayerState?.() ?? -1,
    }), []);

    return (
      <div className={cn("relative overflow-hidden", fillContainer ? "h-full w-full" : "aspect-video w-full", className)}>
        <div ref={hostRef} className={cn("absolute inset-0", !videoId && "invisible")} />
      </div>
    );
  },
);

export default YouTubePlayer;
