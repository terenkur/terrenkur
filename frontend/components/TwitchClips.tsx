"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { proxiedImage } from "@/lib/utils";

interface Clip {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TwitchClips() {
  const [clips, setClips] = useState<Clip[]>([]);

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/twitch_clips`).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.clips)) {
        setClips(data.clips);
      }
    });
  }, []);

  if (!backendUrl || clips.length === 0) return null;

  return (
    <Card className="space-y-2">
      <h2 className="text-lg font-semibold">Twitch Clips</h2>
      <ul className="space-y-2">
        {clips.map((clip) => {
          const thumb = clip.thumbnail_url
            .replace("%{width}", "320")
            .replace("%{height}", "180");
          const src = proxiedImage(thumb) ?? thumb;
          return (
            <li key={clip.id} className="space-y-1">
              <a
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img src={src} alt={clip.title} className="w-full rounded" />
                <p className="text-sm">{clip.title}</p>
              </a>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
