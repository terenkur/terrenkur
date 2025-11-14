// YouTubePlayer.tsx
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

    const updatePlayerSize = useCallback(() => {
      if (!fillContainer) {
        return;
      }
      const container = containerRef.current;
      const player = playerRef.current;
      if (!container || !player?.setSize) {
        return;
      }

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (!cw || !ch) {
        return;
      }

      try {
        player.setSize(cw, ch);
      } catch (err) {
        console.error("Failed to resize YouTube player", err);
      }

      try {
        const el = container.firstElementChild as HTMLElement | null;
        if (el) {
          el.style.position = "absolute";
          el.style.left = "0";
          el.style.top = "0";
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.transform = "none";
        }
      } catch {
        // ignore errors when adjusting iframe styles
      }
    }, [fillContainer]);

    useEffect(() => {
      // Этот useEffect теперь управляет ВСЕМ жизненным циклом плеера
      // на основе наличия videoId.

      // 1. videoId отсутствует (null): Уничтожаем любой существующий плеер.
      if (!videoId) {
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (err) {
            console.error("Failed to destroy YouTube player", err);
          }
          playerRef.current = null;
        }
        return; // Выходим
      }

      // 2. videoId ЕСТЬ и плеер ЕСТЬ: Загружаем новое видео (смена трека).
      if (playerRef.current) {
        try {
          playerRef.current.loadVideoById(videoId);
          // Добавляем принудительный запуск на случай, если autoplay: 1 не сработал
          setTimeout(() => {
            playerRef.current?.playVideo?.();
          }, 500);
        } catch (err) {
          console.error("Failed to change YouTube video", err);
        }
        return; // Выходим
      }

      // 3. videoId ЕСТЬ, а плеера НЕТ: Создаем плеер.
      // Это сработает при переходе из null -> "abc"
      let cancelled = false;
      let playerInstance: any = null;

      loadYouTubeApi()
        .then(() => {
          if (cancelled || !containerRef.current || !window.YT?.Player) {
            return;
          }

          playerInstance = new window.YT.Player(containerRef.current, {
            height: "100%",
            width: "100%",
            videoId: videoId, // Сразу передаем ID
            playerVars: {
              autoplay: 1, // Самое важное
              controls: 0,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event: any) => {
                updatePlayerSize();
                // Autoplay должен был сработать. Форсируем на всякий случай.
                try {
                  event.target.playVideo();
                } catch (err) {
                  console.error("Failed to call playVideo onReady", err);
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
              onError: (event: any) => {
                console.error("YouTube Player Error:", event.data);
              },
            },
          });

          playerRef.current = playerInstance;
        })
        .catch((err) => {
          console.error("Failed to load YouTube IFrame API", err);
        });

      return () => {
        cancelled = true;
        // Очистка теперь обрабатывается в п.1,
        // нам не нужно уничтожать плеер при каждой смене videoId,
        // только при переходе в null.
      };
    }, [videoId, updatePlayerSize, onEnded, onPlaying, onPaused]); // Главная зависимость - videoId

    useEffect(() => {
      if (!fillContainer) {
        return;
      }

      const handleResize = () => {
        updatePlayerSize();
      };

      const timer = setTimeout(handleResize, 100);
      window.addEventListener("resize", handleResize);

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          updatePlayerSize();
        });
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        clearTimeout(timer);
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
          "relative overflow-hidden bg-transparent",
          fillContainer ? "w-full h-full" : "w-full pt-[56.25%] rounded-lg",
          className,
        )}
      >
        <div
          ref={containerRef}
          className={cn(
            "absolute bg-transparent",
            fillContainer ? "inset-0" : "inset-0",
          )}
        />
      </div>
    );
  },
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;