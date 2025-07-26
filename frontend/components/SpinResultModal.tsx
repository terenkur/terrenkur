"use client";
import type { WheelGame } from "./RouletteWheel";

interface SpinResultModalProps {
  eliminated: WheelGame;
  winner?: WheelGame | null;
  onClose: () => void;
}

export default function SpinResultModal({ eliminated, winner, onClose }: SpinResultModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-4 rounded space-y-4 shadow-lg">
        <h2 className="text-xl font-semibold">Dropped game: {eliminated.name}</h2>
        {winner && (
          <p className="text-lg">Winning game: {winner.name}</p>
        )}
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-purple-600 text-white rounded" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
