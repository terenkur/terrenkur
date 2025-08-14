"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import ScrollableList from "@/components/ScrollableList";

interface TwitchVideo {
  id: string;
  title: string;
  thumbnail_url: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TwitchVideos() {
  const [videos, setVideos] = useState<TwitchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    if (!backendUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/twitch_videos`);
      if (!res.ok) {
        throw new Error("Failed to fetch videos");
      }
      const data = await res.json();
      const items = Array.isArray(data.videos) ? data.videos : [];
      if (items.length === 0) {
        setError("No videos found");
      } else {
        setError(null);
      }
      setVideos(items);
    } catch (e) {
      setError((e as Error).message);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  if (!backendUrl) return null;

  const LIST_HEIGHT = 2400;
  if (loading) {
    return (
      <Card variant="shadow" className="space-y-2 relative">
        <h2 className="text-lg font-semibold">Stream VODs</h2>
        <ul className="space-y-2 pr-1" style={{ height: LIST_HEIGHT }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="space-y-1">
              <Skeleton className="w-full rounded aspect-video" />
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (videos.length === 0 || error) {
    return (
      <Card variant="shadow" className="space-y-2 relative">
        <h2 className="text-lg font-semibold">Stream VODs</h2>
        <div className="flex items-center justify-center" style={{ height: LIST_HEIGHT }}>
          <div className="space-y-2 text-center">
            <p className="text-sm">{error || "No videos found"}</p>
            <Button onClick={fetchVideos}>Reload</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <ScrollableList
      title="Stream VODs"
      items={videos}
      height={LIST_HEIGHT}
      renderItem={(v) => {
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
              <Image
                src={src}
                alt={v.title}
                width={320}
                height={180}
                className="w-full rounded"
                loading="lazy"
              />
              <p className="text-sm">{v.title}</p>
            </a>
          </li>
        );
      }}
    />
  );
}
