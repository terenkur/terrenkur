"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Game } from "@/types";

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
}

const RouletteWheel = forwardRef<RouletteWheelHandle, RouletteWheelProps>(
  (
    {
      games,
      onDone,
      size = 300,
      weightCoeff = 2,
      zeroWeight = 40,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rotation, setRotation] = useState(0);
    const spinningRef = useRef(false);

    const maxVotes = games.reduce((m, g) => Math.max(m, g.count), 0);
    const weighted = games.map((g) => ({
      ...g,
      weight:
        g.count === 0
          ? zeroWeight
          : 1 + weightCoeff * (maxVotes - g.count),
    }));
    const totalWeight = weighted.reduce((sum, g) => sum + g.weight, 0);

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
      weighted.forEach((g, idx) => {
        const slice = (g.weight / totalWeight) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.arc(r, r, r - 10, start, start + slice);
        ctx.fillStyle = colorForGame(g.id);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.stroke();

        const mid = start + slice / 2;
        const x = r + (r - 35) * Math.cos(mid);
        const y = r + (r - 35) * Math.sin(mid);
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mid + Math.PI / 2);
        ctx.fillText(g.name, 0, 0);
        ctx.restore();

        start += slice;
      });
    };

    useEffect(() => {
      drawWheel();
    }, [games, weightCoeff, zeroWeight]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.transition = spinningRef.current
          ? "transform 4s cubic-bezier(0.33,1,0.68,1)"
          : "none";
        canvas.style.transform = `rotate(${rotation}rad)`;
      }
    }, [rotation]);

    const spin = () => {
      if (spinningRef.current || games.length === 0) return;
      spinningRef.current = true;
      const rnd = Math.random() * totalWeight;
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
      const target = rotation + spins * 2 * Math.PI + (Math.PI * 3) / 2 - angle;
      setRotation(target);
      setTimeout(() => {
        spinningRef.current = false;
        onDone(selected);
      }, 4000);
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
