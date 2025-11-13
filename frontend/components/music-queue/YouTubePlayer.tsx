"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  onEnded?: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  fillContainer?: boolean;
  className?: string;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    _youtubeIframeAPIPromise?: Promise<void>;
  }
}

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (window._youtubeIframeAPIPromise) {
    return window._youtubeIframeAPIPromise;
  }

  window._youtubeIframeAPIPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") {
        previous();
      }
      resolve();
    };

    const script = document.createElement("script");
    script.id = "youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  });

  return window._youtubeIframeAPIPromise;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (
    { videoId, onEnded, onPlaying, onPaused, fillContainer = false, className },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const readyRef = useRef(false);
    const pendingVideoRef = useRef<string | null>(videoId);

    const updatePlayerSize = useCallback(() => {
      if (!fillContainer) {
        return;
      }
      const container = containerRef.current;
      const player = playerRef.current;
      if (!container || !player?.setSize) {
        return;
      }
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) {
        return;
      }
      try {
        player.setSize(width, height);
      } catch (err) {
        console.error("Failed to resize YouTube player", err);
      }
    }, [fillContainer]);

    useEffect(() => {
      pendingVideoRef.current = videoId;
      if (readyRef.current) {
        if (!videoId) {
          playerRef.current?.stopVideo?.();
        } else {
          try {
            playerRef.current?.loadVideoById(videoId);
          } catch (err) {
            console.error("Failed to load YouTube video", err);
          }
        }
      }
    }, [videoId]);

    useEffect(() => {
      let cancelled = false;
      let playerInstance: any = null;

      loadYouTubeApi()
        .then(() => {
          if (cancelled || !containerRef.current) {
            return;
          }

          const createPlayer = () => {
            playerInstance = new window.YT.Player(containerRef.current!, {
              height: "360",
              width: "640",
              videoId: pendingVideoRef.current || undefined,
              playerVars: {
                autoplay: 1,
                controls: 1,
                rel: 0,
              },
              events: {
                onReady: () => {
                  readyRef.current = true;
                  updatePlayerSize();
                  const targetId = pendingVideoRef.current;
                  pendingVideoRef.current = null;
                  if (targetId) {
                    try {
                      playerInstance.loadVideoById(targetId);
                    } catch (err) {
                      console.error("Failed to start YouTube video", err);
                    }
                  }
                },
                onStateChange: (event: any) => {
                  if (!window.YT || !window.YT.PlayerState) return;
                  const state = event?.data;
                  switch (state) {
                    case window.YT.PlayerState.ENDED:
                      onEnded?.();
                      break;
                    case window.YT.PlayerState.PLAYING:
                      onPlaying?.();
                      break;
                    case window.YT.PlayerState.PAUSED:
                      onPaused?.();
                      break;
                    default:
                      break;
                  }
                },
              },
            });
            playerRef.current = playerInstance;
            updatePlayerSize();
          };

          if (window.YT && window.YT.Player) {
            createPlayer();
          }
        })
        .catch((err) => {
          console.error("Failed to load YouTube IFrame API", err);
        });

      return () => {
        cancelled = true;
        readyRef.current = false;
        pendingVideoRef.current = null;
        if (playerInstance) {
          try {
            playerInstance.destroy();
          } catch (err) {
            console.error("Failed to destroy YouTube player", err);
          }
        }
        playerRef.current = null;
      };
    }, [updatePlayerSize]);

    useEffect(() => {
      if (!fillContainer) {
        return;
      }

      const handleResize = () => {
        updatePlayerSize();
      };

      handleResize();

      window.addEventListener("resize", handleResize);

      let resizeObserver: ResizeObserver | null = null;

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          updatePlayerSize();
        });
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        window.removeEventListener("resize", handleResize);
        resizeObserver?.disconnect();
      };
    }, [fillContainer, updatePlayerSize]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          try {
            playerRef.current?.playVideo?.();
          } catch (err) {
            console.error("Failed to resume YouTube video", err);
          }
        },
        pause: () => {
          try {
            playerRef.current?.pauseVideo?.();
          } catch (err) {
            console.error("Failed to pause YouTube video", err);
          }
        },
        stop: () => {
          try {
            playerRef.current?.stopVideo?.();
          } catch (err) {
            console.error("Failed to stop YouTube video", err);
          }
        },
      }),
      [],
    );

    return (
      <div
        className={cn(
          "relative overflow-hidden",
          videoId ? "bg-black" : "bg-transparent",
          fillContainer ? "w-full h-full" : "w-full pt-[56.25%] rounded-lg",
          className,
        )}
      >
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    );
  },
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;
