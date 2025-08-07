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

  return (
    <div className="flex items-center space-x-2">
      <input
        type="number"
        className="border p-1 w-20 text-black"
        min={min}
        max={maxVal}
        value={minVal}
        onChange={(e) => handleMin(Number(e.target.value))}
      />
      <span>-</span>
      <input
        type="number"
        className="border p-1 w-20 text-black"
        min={minVal}
        max={max}
        value={maxVal}
        onChange={(e) => handleMax(Number(e.target.value))}
      />
    </div>
  );
}

