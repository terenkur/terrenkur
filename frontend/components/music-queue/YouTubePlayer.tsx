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
    
    // 1. Новое состояние для отслеживания загрузки API
    const [apiLoaded, setApiLoaded] = useState(false);

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
      } catch (err) {
        console.error("Failed to resize YouTube player", err);
      }
    }, [fillContainer]);

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
      // Ждем, пока API загрузится и контейнер будет готов
      if (!apiLoaded || !containerRef.current) {
        return;
      }
      
      // API готов. Теперь смотрим, что делать с videoId.

      // Сценарий 1: videoId отсутствует (null).
      // Мы должны уничтожить любой существующий плеер.
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

      // Сценарий 2: videoId ЕСТЬ и плеер ЕСТЬ.
      // Это смена трека. Просто загружаем новое видео.
      if (playerRef.current) {
        try {
          playerRef.current.loadVideoById(videoId);
          // Форсируем воспроизведение на случай, если autoplay не сработал
          setTimeout(() => {
            playerRef.current?.playVideo?.();
          }, 500);
        } catch (err) {
          console.error("Failed to change YouTube video", err);
        }
        return; // Выходим
      }

      // Сценарий 3: videoId ЕСТЬ, API ЕСТЬ, но плеера НЕТ.
      // Это наша "баговая" первая загрузка. Создаем плеер.
      if (!window.YT?.Player) {
         // Дополнительная проверка, на случай если что-то пошло не так
        console.error("YouTubePlayer: apiLoaded is true, but window.YT.Player is missing.");
        return;
      }

      const playerInstance = new window.YT.Player(containerRef.current, {
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
      
    }, [videoId, apiLoaded, updatePlayerSize, onEnded, onPlaying, onPaused]); // <-- Главные зависимости


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