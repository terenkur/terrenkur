"use client";
import type { WheelGame } from "./RouletteWheel";
import { useTranslation } from "react-i18next";

interface SpinResultModalProps {
  eliminated: WheelGame;
  winner?: WheelGame | null;
  onClose: () => void;
}

export default function SpinResultModal({ eliminated, winner, onClose }: SpinResultModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background text-foreground p-4 rounded space-y-4 shadow-lg">
        <h2 className="text-xl font-semibold">
          {t("droppedGame", { name: eliminated.name })}
        </h2>
        {winner && (
          <p className="text-lg">{t("winningGame", { name: winner.name })}</p>
        )}
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-purple-600 text-white rounded" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
