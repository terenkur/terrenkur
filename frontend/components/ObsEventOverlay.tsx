'use client';

import { useEffect, useState } from 'react';

export type ObsEvent = {
  type: 'intim' | 'poceluy';
  timestamp: number;
  text: string;
  gifUrl: string;
  soundUrl: string;
  variant?: string;
};

const DURATION = 5000;

interface Props {
  event: ObsEvent | null;
  onComplete?: () => void;
}

export default function ObsEventOverlay({ event, onComplete }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) return;
    setVisible(true);
    const audio = new Audio(event.soundUrl);
    audio.play().catch(() => {});
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, DURATION);
    return () => {
      clearTimeout(timer);
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // jsdom may not implement pause
      }
    };
  }, [event, onComplete]);

  if (!event || !visible) return null;
  return (
    <div className="flex flex-col items-center text-center">
      <img src={event.gifUrl} alt={event.text} className="max-w-full max-h-screen" />
      <p className="mt-2 text-white text-2xl drop-shadow">{event.text}</p>
    </div>
  );
}
