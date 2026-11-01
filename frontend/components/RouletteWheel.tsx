"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { Game } from "@/types";

const mulberry32 = (a: number) => {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const colorForGame = (id: number) => `hsl(${(id * 137.508) % 360},70%,60%)`;

export interface WheelGame extends Game {
  count: number;
}

export interface RouletteWheelHandle {
  spin: (recordedGameId?: number) => void;
}

interface RouletteWheelProps {
  games: WheelGame[];
  onDone: (game: WheelGame) => void;
  size?: number;
  weightCoeff?: number;
  zeroWeight?: number;
  spinSeed?: string;
  spinDuration?: number;
  highlightedId?: number | null;
  onHighlight?: (id: number | null) => void;
  onSelectGame?: (id: number) => void;
}

const RouletteWheel = forwardRef<RouletteWheelHandle, RouletteWheelProps>(
  (
    {
      games,
      onDone,
      size: propSize,
      weightCoeff = 2,
      zeroWeight = 40,
      spinSeed,
      spinDuration = 4,
      highlightedId,
      onHighlight,
      onSelectGame,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    type LoadedImage = CanvasImageSource & { width: number; height: number };
    const imagesRef = useRef<Map<number, LoadedImage>>(new Map());
    const loadingRef = useRef<Set<number>>(new Set());
    const highlightRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [rotation, setRotation] = useState(0);
    const spinningRef = useRef(false);
    const randRef = useRef<() => number>(() => Math.random());
    const [highlightGame, setHighlightGame] = useState<
      (WheelGame & { weight: number }) | null
    >(null);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const [movingId, setMovingId] = useState<number | null>(null);
    const frame = useRef(0);
    const finishTimer = useRef(0);
    const clickAudioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
      clickAudioRef.current = new Audio("/click_wheel.mp3");
      clickAudioRef.current.preload = "auto";
      return () => { clickAudioRef.current = null; };
    }, []);
    const clickTimeoutsRef = useRef<number[]>([]);

    const [autoSize, setAutoSize] = useState(500);
    useEffect(() => {
      const updateSize = () => {
        setAutoSize(Math.max(1, Math.min(500, wrapperRef.current?.clientWidth || window.innerWidth - 64)));
      };
      updateSize();
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateSize);
      if (wrapperRef.current) observer?.observe(wrapperRef.current);
      window.addEventListener("resize", updateSize);
      return () => { observer?.disconnect(); window.removeEventListener("resize", updateSize); };
    }, []);
    const size = propSize ?? autoSize;

    useEffect(() => {
      if (typeof IntersectionObserver === "undefined") {
        setIsVisible(true);
        return;
      }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      });
      if (containerRef.current) {
        observer.observe(containerRef.current);
      }
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (spinSeed) {
        let seed = 0;
        for (let i = 0; i < spinSeed.length; i++) {
          seed = (seed * 31 + spinSeed.charCodeAt(i)) >>> 0;
        }
        randRef.current = mulberry32(seed);
      } else {
        randRef.current = Math.random;
      }
    }, [spinSeed]);

    useEffect(() => {
      return () => {
        cancelAnimationFrame(frame.current);
        clearTimeout(finishTimer.current);
        clickTimeoutsRef.current.forEach((id) => clearTimeout(id));
        clickTimeoutsRef.current = [];
      };
    }, []);

    const maxVotes = games.reduce((m, g) => Math.max(m, g.count), 0);
    const weighted = useMemo(() => games.map((g) => ({
      ...g,
      weight:
        g.count === 0
          ? zeroWeight
          : 1 + weightCoeff * (maxVotes - g.count),
    })), [games, maxVotes, zeroWeight, weightCoeff]);
    const totalWeight = weighted.reduce((sum, g) => sum + g.weight, 0);
    const drawWheel = useCallback(() => {
      if (!isVisible) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const r = size / 2;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      let start = -Math.PI / 2;
      weighted.forEach((g) => {
        const slice = (g.weight / totalWeight) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.arc(r, r, r - 10, start, start + slice);
        ctx.closePath();
        if (g.background_image) {
          const img = imagesRef.current.get(g.id);
          if (img && (img as any).width > 0 && (img as any).height > 0) {
            const width = (img as any).width as number;
            const height = (img as any).height as number;
            ctx.save();
            ctx.clip();
            const scale = Math.max(size / width, size / height);
            const w = width * scale;
            const h = height * scale;
            ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
            ctx.restore();
          } else {
            ctx.fillStyle = colorForGame(g.id);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = colorForGame(g.id);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(12, 9, 24, 0.38)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.stroke();

        const mid = start + slice / 2;
        const fontSize = Math.max(12, size / 35);
        start += slice;
        if (slice * r * 0.55 < fontSize * 1.6) return;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const maxWidth = r * 0.62;
        let label = g.name;
        while (label && ctx.measureText(label).width > maxWidth) {
          const end = label.lastIndexOf(" ");
          if (end < 0) return;
          label = label.slice(0, end);
        }
        const labelWidth = ctx.measureText(label).width;
        let textRadius = Math.min(r - 35, r - labelWidth / 2 - 10);
        if (textRadius < 0) textRadius = 0;
        const x = r + textRadius * Math.cos(mid);
        const y = r + textRadius * Math.sin(mid);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mid + (Math.cos(mid) < 0 ? Math.PI : 0));
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, 0, 0);
        ctx.restore();

      });
    }, [isVisible, size, weighted, totalWeight]);

    useEffect(() => {
      if (!isVisible) return;
      weighted.forEach((g) => {
        if (
          g.background_image &&
          !imagesRef.current.has(g.id) &&
          !loadingRef.current.has(g.id)
        ) {
          loadingRef.current.add(g.id);
          const img = new Image();
          const src =
            backendUrl && g.background_image.startsWith("http")
              ? `${backendUrl}/api/proxy?url=${encodeURIComponent(
                  g.background_image
                )}`
              : g.background_image;
          if (src.startsWith("http")) {
            img.crossOrigin = "anonymous";
          }
          img.decoding = "async";
          img.src = src;
          img.onload = async () => {
            let source: LoadedImage = img;
            try {
              if (typeof createImageBitmap !== "undefined") {
                const scale = Math.min(1, size / img.width, size / img.height);
                const targetWidth = Math.round(img.width * scale);
                const targetHeight = Math.round(img.height * scale);
                source = (await createImageBitmap(img, {
                  resizeWidth: targetWidth,
                  resizeHeight: targetHeight,
                  resizeQuality: "medium",
                })) as LoadedImage;
              }
            } catch {
              // ignore errors and use original image
            }
            imagesRef.current.set(g.id, source);
            loadingRef.current.delete(g.id);
            drawWheel();
          };
          img.onerror = () => {
            console.warn(
              `Failed to load image for game ${g.id}: ${g.background_image}`
            );
            loadingRef.current.delete(g.id);
            drawWheel();
          };
        }
      });
    }, [weighted, backendUrl, size, isVisible, drawWheel]);

    useEffect(() => {
      drawWheel();
    }, [drawWheel]);

    useEffect(() => {
      const canvas = highlightRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const r = size / 2;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      let start = -Math.PI / 2 + rotation;
      const activeId = highlightedId ?? highlightGame?.id;
      for (const game of weighted) {
        const slice = game.weight / totalWeight * Math.PI * 2;
        if (game.id === activeId && (!spinningRef.current || highlightGame?.id === game.id)) {
          ctx.beginPath();
          ctx.moveTo(r, r);
          ctx.arc(r, r, r - 10, start, start + slice);
          ctx.closePath();
          ctx.fillStyle = "rgba(196,181,253,0.4)";
          ctx.fill();
          ctx.strokeStyle = "#ede9fe";
          ctx.lineWidth = 3;
          ctx.stroke();
          canvas.style.opacity = "1";
          return;
        }
        start += slice;
      }
      canvas.style.opacity = "0";
    }, [highlightGame, highlightedId, rotation, size, totalWeight, weighted]);

    // Angles are clockwise from the fixed pointer at twelve o'clock.
    const sectorAt = (angle: number) => {
      const turn = Math.PI * 2;
      const position = ((angle % turn + turn) % turn) / turn * totalWeight;
      let end = 0;
      return weighted.find(game => (end += game.weight) > position);
    };
    const pointerGame = movingId === null ? sectorAt(-rotation) : weighted.find(g => g.id === movingId);
    const gameAtPointer = (event: React.MouseEvent<HTMLDivElement>) => {
      if (spinningRef.current) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      const radius = Math.hypot(x, y);
      return radius <= size / 2 - 10 && radius > size * 0.13
        ? sectorAt(Math.atan2(y, x) + Math.PI / 2 - rotation) : undefined;
    };

    const durationRef = useRef(spinDuration);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.transition = spinningRef.current
          ? `transform ${durationRef.current}s cubic-bezier(0.33,1,0.68,1)`
          : "none";
        canvas.style.transform = `rotate(${rotation}rad)`;
      }
    }, [rotation]);

    const spin = (recordedGameId?: number) => {
      if (spinningRef.current || games.length === 0) return;
      spinningRef.current = true;
      setMovingId(sectorAt(-rotation)?.id ?? null);
      setHighlightGame(null);
      onHighlight?.(null);
      clickTimeoutsRef.current.forEach((id) => clearTimeout(id));
      clickTimeoutsRef.current = [];
      const rnd = randRef.current() * totalWeight;
      let cumulative = 0;
      let selected = weighted[0];
      for (const item of weighted) {
        cumulative += item.weight;
        if (rnd <= cumulative) {
          selected = item;
          break;
        }
      }
      selected = weighted.find(game => game.id === recordedGameId) ?? selected;
      let angle = -Math.PI / 2;
      for (const item of weighted) {
        const slice = (item.weight / totalWeight) * Math.PI * 2;
        if (item.id === selected.id) {
          angle += slice / 2;
          break;
        }
        angle += slice;
      }
      const spins = 4;
      const duration = spinDuration + (randRef.current() - 0.5) * 2;
      durationRef.current = duration;
      const normalized = rotation % (2 * Math.PI);
      const target =
        rotation + spins * 2 * Math.PI + (Math.PI * 3) / 2 - angle - normalized;
      const delta = target - rotation;
      const omega = delta / duration;
      const boundaries: number[] = [];
      let start = -Math.PI / 2;
      for (const item of weighted) {
        const slice = (item.weight / totalWeight) * Math.PI * 2;
        start += slice;
        boundaries.push((start + 2 * Math.PI) % (2 * Math.PI));
      }
      for (const b of boundaries) {
        for (let k = 0; ; k++) {
          const crossing = b + 2 * Math.PI * k;
          if (crossing <= rotation) continue;
          if (crossing >= target) break;
          const time = ((crossing - rotation) / omega) * 1000;
          const id = window.setTimeout(() => {
            const audio = clickAudioRef.current;
            if (!audio) return;
            audio.pause();
            audio.currentTime = 0;
            void audio.play();
          }, time);
          clickTimeoutsRef.current.push(id);
        }
      }
      setRotation(target);
      const trackPointer = () => {
        const canvas = canvasRef.current;
        if (!canvas || !spinningRef.current) return;
        const transform = getComputedStyle(canvas).transform;
        if (transform?.startsWith('matrix(')) {
          const [cos, sin] = transform.slice(7, -1).split(',').map(Number);
          setMovingId(sectorAt(-Math.atan2(sin, cos))?.id ?? null);
        }
        frame.current = requestAnimationFrame(trackPointer);
      };
      frame.current = requestAnimationFrame(trackPointer);
      finishTimer.current = window.setTimeout(() => {
        cancelAnimationFrame(frame.current);
        setMovingId(null);
        setHighlightGame(selected);
        onHighlight?.(selected.id);
        finishTimer.current = window.setTimeout(() => {
          spinningRef.current = false;
          onHighlight?.(null);
          onDone(selected);
        }, 450);
        clickTimeoutsRef.current.forEach((id) => clearTimeout(id));
        clickTimeoutsRef.current = [];
      }, duration * 1000);
    };

    useImperativeHandle(ref, () => ({ spin }));

    return (
      <div ref={wrapperRef} className="flex w-full min-w-0 flex-col items-center">
        <p className="mb-5 w-full break-words text-center text-sm">
          Под стрелкой · <strong>{pointerGame?.name ?? "—"}</strong>
        </p>
        <div
          ref={containerRef}
          className="relative"
          style={{ width: size, height: size, marginTop: "-10px" }}
          onPointerMove={event => {
            if (!spinningRef.current) onHighlight?.(gameAtPointer(event)?.id ?? null);
          }}
          onClick={event => {
            const game = gameAtPointer(event);
            if (game) onSelectGame?.(game.id);
          }}
          onPointerLeave={() => onHighlight?.(null)}
        >
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="pointer-events-none"
          />
            <canvas
              ref={highlightRef}
              className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
            />
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-transparent border-t-purple-600"
            style={{ transform: "translateY(-6px)" }}
          />
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/30 bg-zinc-950 text-center text-white shadow-lg"
            style={{ fontSize: Math.max(9, size * 0.029) }}>
            <strong>{games.length === 2 ? "Финал" : "На выбывание"}</strong>
            <span>{games.length === 2 ? "2 игры" : `Осталось: ${games.length}`}</span>
          </div>
        </div>
      </div>
    );
  }
);

RouletteWheel.displayName = "RouletteWheel";
export default RouletteWheel;
