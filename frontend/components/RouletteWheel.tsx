"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
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
      size = 300,
      weightCoeff = 2,
      zeroWeight = 40,
      spinSeed,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
    const [rotation, setRotation] = useState(0);
    const spinningRef = useRef(false);
    const randRef = useRef<() => number>(() => Math.random());

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

    useEffect(() => {
      weighted.forEach((g) => {
        if (g.background_image && !imagesRef.current.has(g.id)) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = g.background_image;
          img.onload = () => {
            imagesRef.current.set(g.id, img);
            drawWheel();
          };
          img.onerror = () => {
            imagesRef.current.delete(g.id);
            drawWheel();
          };
          imagesRef.current.set(g.id, img);
        }
      });
    }, [weighted]);

    const drawWheel = () => {
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
          if (
            img &&
            img.complete &&
            img.naturalWidth > 0 &&
            img.naturalHeight > 0
          ) {
            ctx.save();
            ctx.clip();
            const scale = Math.max(size / img.width, size / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
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
        const x = r + (r - 35) * Math.cos(mid);
        const y = r + (r - 35) * Math.sin(mid);
        const fontSize = Math.min(slice * r, 14);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mid);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        const label = g.name.length > 10 ? g.name.slice(0, 10) + "…" : g.name;
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, 0, 0);
        ctx.restore();

        start += slice;
      });
    };

    useEffect(() => {
      drawWheel();
    }, [games, weightCoeff, zeroWeight]);

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
      const target = rotation + spins * 2 * Math.PI + (Math.PI * 3) / 2 - angle;
      setRotation(target);
      setTimeout(() => {
        spinningRef.current = false;
        onDone(selected);
      }, duration * 1000);
    };

    useImperativeHandle(ref, () => ({ spin }));

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} width={size} height={size} />
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-red-500"
          style={{ transform: "translateY(-2px)" }}
        />
      </div>
    );
  }
);

RouletteWheel.displayName = "RouletteWheel";
export default RouletteWheel;
