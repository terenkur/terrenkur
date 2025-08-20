'use client';

import { useEffect, useState } from 'react';
import ObsEventOverlay, { ObsEvent } from '@/components/ObsEventOverlay';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ObsPage() {
  const [event, setEvent] = useState<ObsEvent | null>(null);

  useEffect(() => {
    if (!backendUrl) return;
    const es = new EventSource(`${backendUrl}/api/obs-events`);
    es.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const data: ObsEvent = {
          type: raw.type,
          text: raw.text ?? raw.message ?? '',
          gifUrl: raw.gifUrl ?? raw.gif_url ?? '',
          soundUrl: raw.soundUrl ?? raw.sound_url ?? '',
          timestamp: raw.timestamp ?? Date.now(),
          variant: raw.variant,
        };
        setEvent(data);
      } catch (err) {
        console.error('Failed to parse event', err);
      }
    };
    return () => es.close();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-transparent pointer-events-none">
      <ObsEventOverlay event={event} onComplete={() => setEvent(null)} />
    </div>
  );
}
