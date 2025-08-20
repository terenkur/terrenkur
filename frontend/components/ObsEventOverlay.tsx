'use client';

import { useEffect, useState } from 'react';

export type ObsEvent = {
  type: 'intim' | 'poceluy';
  timestamp: number;
};

const MEDIA: Record<ObsEvent['type'], { gif: string; sound: string; text: string; duration: number }> = {
  intim: {
    gif: '/obs/intim.gif',
    sound: '/obs/intim.mp3',
    text: 'Интим',
    duration: 5000,
  },
  poceluy: {
    gif: '/obs/poceluy.gif',
    sound: '/obs/poceluy.mp3',
    text: 'Поцелуй',
    duration: 5000,
  },
};

interface Props {
  event: ObsEvent | null;
  onComplete?: () => void;
}

export default function ObsEventOverlay({ event, onComplete }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) return;
    const settings = MEDIA[event.type];
    if (!settings) return;
    setVisible(true);
    const audio = new Audio(settings.sound);
    audio.play().catch(() => {});
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, settings.duration);
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

  if (!event) return null;
  const settings = MEDIA[event.type];
  if (!settings || !visible) return null;
  return (
    <div className="flex flex-col items-center text-center">
      <img src={settings.gif} alt={settings.text} className="max-w-full max-h-screen" />
      <p className="mt-2 text-white text-2xl drop-shadow">{settings.text}</p>
    </div>
  );
}

export { MEDIA as OBS_MEDIA_SETTINGS };
