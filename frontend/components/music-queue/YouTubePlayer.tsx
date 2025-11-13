"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

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
  ({ videoId, onEnded, onPlaying, onPaused }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const readyRef = useRef(false);
    const pendingVideoRef = useRef<string | null>(videoId);

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
    }, []);

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
      []
    );

    return (
      <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;
