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
    <div className="space-y-1 w-full">
      <div className="flex items-center space-x-2">
        <input
          type="range"
          className="flex-grow"
          min={min}
          max={maxVal}
          value={minVal}
          onChange={(e) => handleMin(Number(e.target.value))}
        />
        <span className="w-10 text-center text-sm">{minVal}</span>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="range"
          className="flex-grow"
          min={minVal}
          max={max}
          value={maxVal}
          onChange={(e) => handleMax(Number(e.target.value))}
        />
        <span className="w-10 text-center text-sm">{maxVal}</span>
      </div>
    </div>
  );
}

