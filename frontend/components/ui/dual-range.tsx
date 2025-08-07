"use client";

import * as React from "react";

interface DualRangeProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

export function DualRange({ min, max, value, onChange }: DualRangeProps) {
  const [minVal, maxVal] = value;

  const handleMin = (val: number) => {
    const clamped = Math.min(Math.max(val, min), maxVal);
    onChange([clamped, maxVal]);
  };

  const handleMax = (val: number) => {
    const clamped = Math.max(Math.min(val, max), minVal);
    onChange([minVal, clamped]);
  };

  const range = max - min;
  const minPercent = ((minVal - min) / range) * 100;
  const maxPercent = ((maxVal - min) / range) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="relative h-4">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-secondary" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-primary"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          onChange={(e) => handleMin(Number(e.target.value))}
          className="absolute inset-0 h-4 w-full appearance-none bg-transparent pointer-events-none"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          onChange={(e) => handleMax(Number(e.target.value))}
          className="absolute inset-0 h-4 w-full appearance-none bg-transparent pointer-events-none"
        />
      </div>
      <div className="flex justify-between text-sm">
        <span>{minVal}</span>
        <span>{maxVal}</span>
      </div>
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          pointer-events: auto;
          height: 1rem;
          width: 1rem;
          border-radius: 9999px;
          background: hsl(var(--primary));
          border: none;
        }
        input[type="range"]::-moz-range-thumb {
          pointer-events: auto;
          height: 1rem;
          width: 1rem;
          border-radius: 9999px;
          background: hsl(var(--primary));
          border: none;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          background: transparent;
        }
        input[type="range"]::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}

