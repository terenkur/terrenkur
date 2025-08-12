import React from "react";

export type MedalType = "gold" | "silver" | "bronze";

const MEDAL_ICONS: Record<MedalType, string> = {
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
};

interface MedalIconProps {
  type?: MedalType | null;
  className?: string;
}

export default function MedalIcon({ type, className }: MedalIconProps) {
  if (!type) return null;
  return <span className={className}>{MEDAL_ICONS[type]}</span>;
}

export { MEDAL_ICONS };
