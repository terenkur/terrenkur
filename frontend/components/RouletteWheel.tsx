"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
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
  spin: () => void;
}

interface RouletteWheelProps {
  games: WheelGame[];
  onDone: (game: WheelGame) => void;
  size?: number;
  weightCoeff?: number;
  zeroWeight?: number;
  spinSeed?: string;
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
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    type LoadedImage = CanvasImageSource & { width: number; height: number };
    const imagesRef = useRef<Map<number, LoadedImage>>(new Map());
    const loadingRef = useRef<Set<number>>(new Set());
    const highlightRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [rotation, setRotation] = useState(0);
    const spinningRef = useRef(false);
    const randRef = useRef<() => number>(() => Math.random());
    const [highlightGame, setHighlightGame] = useState<
      (WheelGame & { weight: number }) | null
    >(null);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const [tooltip, setTooltip] = useState<{
      visible: boolean;
      text: string;
      x: number;
      y: number;
    }>({ visible: false, text: "", x: 0, y: 0 });

    const [autoSize, setAutoSize] = useState(500);
    useEffect(() => {
      const updateSize = () => {
        setAutoSize(Math.min(500, window.innerWidth - 32));
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
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

    const maxVotes = games.reduce((m, g) => Math.max(m, g.count), 0);
    const weighted = games.map((g) => ({
      ...g,
      weight:
        g.count === 0
          ? zeroWeight
          : 1 + weightCoeff * (maxVotes - g.count),
    }));
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
        ctx.strokeStyle = "#fff";
        ctx.stroke();

        const mid = start + slice / 2;
        const fontSize = Math.min(slice * r, size / 35);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const pxPerChar = fontSize * 0.6;
        const maxChars = Math.max(1, Math.floor((slice * r) / pxPerChar));
        const label =
          g.name.length > maxChars
            ? g.name.slice(0, Math.max(1, maxChars - 1)) + "…"
            : g.name;
        const labelWidth = ctx.measureText(label).width;
        let textRadius = Math.min(r - 35, r - labelWidth / 2 - 10);
        if (textRadius < 0) textRadius = 0;
        const x = r + textRadius * Math.cos(mid);
        const y = r + textRadius * Math.sin(mid);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mid);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, 0, 0);
        ctx.restore();

        start += slice;
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
      if (highlightGame) {
        const slice = (highlightGame.weight / totalWeight) * Math.PI * 2;
        const start = -Math.PI / 2 - slice / 2;
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.arc(r, r, r - 10, start, start + slice);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
        canvas.style.opacity = "1";
      } else {
        canvas.style.opacity = "0";
      }
    }, [highlightGame, size, totalWeight]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const r = size / 2;
      const dx = x - r;
      const dy = y - r;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r - 10 || dist > r) {
        if (tooltip.visible) setTooltip((t) => ({ ...t, visible: false }));
        return;
      }
      let angle = Math.atan2(dy, dx) - rotation;
      angle = (angle + 2 * Math.PI) % (2 * Math.PI);
      let start = -Math.PI / 2;
      for (const g of weighted) {
        const slice = (g.weight / totalWeight) * Math.PI * 2;
        if (angle >= start && angle < start + slice) {
          setTooltip({ visible: true, text: g.name, x: x + 10, y: y + 10 });
          return;
        }
        start += slice;
      }
      setTooltip((t) => ({ ...t, visible: false }));
    };

    const handleMouseLeave = () => {
      setTooltip((t) => ({ ...t, visible: false }));
    };

    const durationRef = useRef(4);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.transition = spinningRef.current
          ? `transform ${durationRef.current}s cubic-bezier(0.33,1,0.68,1)`
          : "none";
        canvas.style.transform = `rotate(${rotation}rad)`;
      }
    }, [rotation]);

    const spin = () => {
      if (spinningRef.current || games.length === 0) return;
      spinningRef.current = true;
      setHighlightGame(null);
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
      const duration = 3 + randRef.current() * 2; // 3-5 seconds
      durationRef.current = duration;
      const normalized = rotation % (2 * Math.PI);
      const target =
        rotation + spins * 2 * Math.PI + (Math.PI * 3) / 2 - angle - normalized;
      setRotation(target);
      setTimeout(() => {
        spinningRef.current = false;
        setHighlightGame(selected);
        onDone(selected);
      }, duration * 1000);
    };

    useImperativeHandle(ref, () => ({ spin }));

    return (
      <div className="flex flex-col items-center">
        <div
          ref={containerRef}
          className="relative"
          style={{ width: size, height: size, marginTop: "-10px" }}
        >
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            />
            <canvas
              ref={highlightRef}
              className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
            />
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-transparent border-t-purple-600"
            style={{ transform: "translateY(-6px)" }}
          />
          {tooltip.visible && (
            <div
              className="absolute bg-black text-white text-xs px-2 py-1 rounded pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
        <ol className="mt-4 sm:hidden list-decimal list-inside text-sm">
          {weighted.map((g, i) => (
            <li key={g.id}>
              {i + 1}. {g.name}
            </li>
          ))}
        </ol>
      </div>
    );
  }
);

RouletteWheel.displayName = "RouletteWheel";
export default RouletteWheel;
