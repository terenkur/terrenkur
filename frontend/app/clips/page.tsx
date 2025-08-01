"use client";

import { useEffect, useState } from "react";
import { proxiedImage } from "@/lib/utils";

interface Clip {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ClipsPage() {
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

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  return (
    <main className="col-span-10 p-4 max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Twitch Clips</h1>
      <ul className="space-y-4">
        {clips.map((clip) => {
          const thumb = clip.thumbnail_url
            .replace("%{width}", "480")
            .replace("%{height}", "272");
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
    </main>
  );
}
