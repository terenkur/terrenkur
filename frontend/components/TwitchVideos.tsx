"use client";

import { useEffect, useState } from "react";

interface TwitchVideo {
  id: string;
  title: string;
  thumbnail_url: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TwitchVideos() {
  const [videos, setVideos] = useState<TwitchVideo[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/twitch_videos`).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.videos)) {
        setVideos(data.videos);
      }
    });
  }, []);

  if (!backendUrl || videos.length === 0) return null;

  const visible = videos.slice(index, index + 3);
  const canUp = index > 0;
  const canDown = index + 3 < videos.length;

  const up = () => setIndex((i) => Math.max(0, i - 1));
  const down = () => setIndex((i) => Math.min(videos.length - 3, i + 1));

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Stream VODs</h2>
      <ul className="space-y-2">
        {visible.map((v) => {
          const thumb = v.thumbnail_url
            .replace("%{width}", "320")
            .replace("%{height}", "180");
          const src =
            thumb.startsWith("http") && backendUrl
              ? `${backendUrl}/api/proxy?url=${encodeURIComponent(thumb)}`
              : thumb;
          return (
            <li key={v.id} className="space-y-1">
              <a
                href={`https://www.twitch.tv/videos/${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img src={src} alt={v.title} className="w-full rounded" />
                <p className="text-sm">{v.title}</p>
              </a>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between">
        <button
          className="px-2 py-1 bg-gray-300 rounded disabled:opacity-50"
          onClick={up}
          disabled={!canUp}
        >
          Up
        </button>
        <button
          className="px-2 py-1 bg-gray-300 rounded disabled:opacity-50"
          onClick={down}
          disabled={!canDown}
        >
          Down
        </button>
      </div>
    </div>
  );
}
