"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface Reward {
  id: string;
  title: string;
}

interface ObsMediaItem {
  id?: number;
  gif: string;
  sound: string;
}

interface SettingsContextValue {
  rewards: Reward[];
  setRewards: React.Dispatch<React.SetStateAction<Reward[]>>;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  obsMedia: Record<string, ObsMediaItem[]>;
  setObsMedia: React.Dispatch<
    React.SetStateAction<Record<string, ObsMediaItem[]>>
  >;
  obsTypes: string[];
  setObsTypes: React.Dispatch<React.SetStateAction<string[]>>;
  removedMedia: number[];
  setRemovedMedia: React.Dispatch<React.SetStateAction<number[]>>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [obsMedia, setObsMedia] = useState<Record<string, ObsMediaItem[]>>({});
  const [obsTypes, setObsTypes] = useState<string[]>([]);
  const [removedMedia, setRemovedMedia] = useState<number[]>([]);

  return (
    <SettingsContext.Provider
      value={{
        rewards,
        setRewards,
        selected,
        setSelected,
        obsMedia,
        setObsMedia,
        obsTypes,
        setObsTypes,
        removedMedia,
        setRemovedMedia,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

