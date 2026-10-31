"use client";
import type { WheelGame } from "./RouletteWheel";
import { useTranslation } from "react-i18next";
import { proxiedImage } from "@/lib/utils";

interface SpinResultModalProps {
  eliminated: WheelGame;
  winner?: WheelGame | null;
  onClose: () => void;
}

export default function SpinResultModal({ eliminated, winner, onClose }: SpinResultModalProps) {
  const { t } = useTranslation();
  const cover = proxiedImage((winner ?? eliminated).background_image);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div role="dialog" aria-modal="true" aria-labelledby="spin-result" className={`mx-4 w-full max-w-sm space-y-4 rounded-xl border bg-background p-5 text-foreground shadow-lg ${winner ? 'border-amber-400 motion-safe:animate-in motion-safe:zoom-in-95' : ''}`}>
        {cover && <img src={cover} alt="" className="h-24 w-full rounded-lg object-cover" />}
        {winner && (
          <p id="spin-result" className="rounded bg-amber-100 p-3 text-xl font-bold text-amber-950">{t("winningGame", { name: winner.name })}</p>
        )}
        <h2 id={winner ? undefined : "spin-result"} className={winner ? "text-sm" : "text-xl font-semibold"}>
          {t("droppedGame", { name: eliminated.name })}
        </h2>
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-purple-600 text-white rounded" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
