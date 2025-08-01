"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface TwitchVideo {
  id: string;
  title: string;
  thumbnail_url: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TwitchVideos() {
  const [videos, setVideos] = useState<TwitchVideo[]>([]);
  const listRef = useRef<HTMLUListElement | null>(null);
  const headerRef = useRef<HTMLHeadingElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const [itemHeight, setItemHeight] = useState(0);

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.clientHeight);
    }
    const handleResize = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const first = list.querySelector('li');
    if (first) {
      setItemHeight(first.clientHeight);
    }
    const update = () => {
      setCanUp(list.scrollTop > 0);
      setCanDown(list.scrollTop + list.clientHeight < list.scrollHeight);
    };
    update();
    list.addEventListener('scroll', update);
    return () => list.removeEventListener('scroll', update);
  }, [videos]);

  if (!backendUrl || videos.length === 0) return null;

  const up = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ top: -itemHeight, behavior: "smooth" });
  };

  const down = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ top: itemHeight, behavior: "smooth" });
  };

  return (
    <Card className="space-y-2 relative">
      <h2 ref={headerRef} className="text-lg font-semibold">Stream VODs</h2>
      <ul
        ref={listRef}
        className="space-y-2 overflow-y-auto scroll-smooth pr-1"
        style={{ maxHeight: itemHeight ? itemHeight * 12 : 2400 }}
      >
        {videos.map((v) => {
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
      <button
        className="absolute bg-gray-300 rounded-full p-1 disabled:opacity-50"
        style={{ top: headerHeight + 8, left: "calc(50% - 8px)" }}
        onClick={up}
        disabled={!canUp}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
      </button>
      <button
        className="absolute bg-gray-300 rounded-full p-1 disabled:opacity-50"
        style={{ bottom: 8, left: "calc(50% - 8px)" }}
        onClick={down}
        disabled={!canDown}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </Card>
  );
}
