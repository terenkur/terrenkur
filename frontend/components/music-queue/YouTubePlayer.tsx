// YouTubePlayer.tsx
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState, // <-- Импортируем useState
} from "react";
import { cn } from "@/lib/utils";

// ... (интерфейсы и объявление global window) ...
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
// ... (конец интерфейсов) ...


function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  // API уже загружен
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  // API в процессе загрузки
  if (window._youtubeIframeAPIPromise) {
    return window._youtubeIframeAPIPromise;
  }

  // Запускаем загрузку API
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
    const lastVideoIdRef = useRef<string | null>(null);
    
    // 1. Новое состояние для отслеживания загрузки API
    const [apiLoaded, setApiLoaded] = useState(false);

    const ensureIframeAttributes = useCallback(() => {
      const iframe =
        playerRef.current?.getIframe?.() ??
        (containerRef.current?.querySelector("iframe") as
          | HTMLIFrameElement
          | null);
      if (!iframe) return;
      iframe.setAttribute("allow", "autoplay; fullscreen");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("allowtransparency", "true");
      iframe.style.backgroundColor = "black";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    }, []);

    const updatePlayerSize = useCallback(() => {
      if (!fillContainer) return;
      const container = containerRef.current;
      const player = playerRef.current;
      if (!container || !player?.setSize) return;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (!cw || !ch) return;

      try {
        player.setSize(cw, ch);
        const el = container.firstElementChild as HTMLElement | null;
        if (el) {
          el.style.position = "absolute";
          el.style.left = "0";
          el.style.top = "0";
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.transform = "none";
        }
        ensureIframeAttributes();
      } catch (err) {
        console.error("Failed to resize YouTube player", err);
      }
    }, [fillContainer, ensureIframeAttributes]);

    // 2. Этот useEffect запускается один раз при монтировании
    // Его единственная задача - загрузить API и установить apiLoaded = true
    useEffect(() => {
      // Если API уже есть (например, при быстрой смене страниц)
      if (window.YT && window.YT.Player) {
        setApiLoaded(true);
        return;
      }
      
      let cancelled = false;
      loadYouTubeApi()
        .then(() => {
          if (!cancelled) {
            setApiLoaded(true);
          }
        })
        .catch((err) => {
          console.error("Failed to load YouTube IFrame API", err);
        });
        
      return () => {
        cancelled = true;
      };
    }, []); // <-- Пустой массив зависимостей, запускается 1 раз

    // 3. Этот useEffect управляет плеером
    // Он будет ждать, пока И videoId, И apiLoaded не станут готовы
    useEffect(() => {
      if (!apiLoaded) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const destroyPlayer = () => {
        if (!playerRef.current) return;
        try {
          playerRef.current.destroy();
        } catch (err) {
          console.error("Failed to destroy YouTube player", err);
        } finally {
          playerRef.current = null;
        }
      };

      const createPlayer = (id: string) => {
        if (!window.YT?.Player) {
          console.error(
            "YouTubePlayer: apiLoaded is true, but window.YT.Player is missing.",
          );
          return;
        }

        container.innerHTML = "";

        const playerInstance = new window.YT.Player(container, {
          height: "100%",
          width: "100%",
          videoId: id,
          playerVars: {
            autoplay: 1,
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
              ensureIframeAttributes();
              try {
                event.target.playVideo();
              } catch (err) {
                console.error("Failed to call playVideo onReady", err);
              }
            },
            onStateChange: (event: any) => {
              if (!window.YT || !window.YT.PlayerState) return;
              const state = event?.data;
              if (state === window.YT.PlayerState.ENDED) onEnded?.();
              if (state === window.YT.PlayerState.PLAYING) onPlaying?.();
              if (state === window.YT.PlayerState.PAUSED) onPaused?.();
            },
            onError: (event: any) => {
              console.error("YouTube Player Error:", event.data);
            },
          },
        });

        playerRef.current = playerInstance;
        lastVideoIdRef.current = id;
        ensureIframeAttributes();
      };

      if (!videoId) {
        destroyPlayer();
        lastVideoIdRef.current = null;
        return;
      }

      if (!playerRef.current) {
        createPlayer(videoId);
        return;
      }

      if (lastVideoIdRef.current === videoId) {
        try {
          playerRef.current.playVideo?.();
        } catch (err) {
          console.error("Failed to resume YouTube video", err);
        }
        return;
      }

      destroyPlayer();
      createPlayer(videoId);
    }, [
      videoId,
      apiLoaded,
      updatePlayerSize,
      onEnded,
      onPlaying,
      onPaused,
      ensureIframeAttributes,
    ]);

    useEffect(() => {
      return () => {
        try {
          playerRef.current?.destroy?.();
        } catch (err) {
          console.error("Failed to destroy YouTube player on unmount", err);
        } finally {
          playerRef.current = null;
          lastVideoIdRef.current = null;
        }
      };
    }, []);


    // ... (остальной код: useEffect[fillContainer] и useImperativeHandle) ...

    useEffect(() => {
      if (!fillContainer) return;
      const handleResize = () => updatePlayerSize();
      const timer = setTimeout(handleResize, 100);
      window.addEventListener("resize", handleResize);
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(handleResize);
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
        play: () => playerRef.current?.playVideo?.(),
        pause: () => playerRef.current?.pauseVideo?.(),
        stop: () => playerRef.current?.stopVideo?.(),
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