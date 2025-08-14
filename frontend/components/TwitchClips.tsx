"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
  }, [clips]);

  const fetchClips = async () => {
    if (!backendUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/twitch_clips`);
      if (!res.ok) {
        throw new Error("Failed to fetch clips");
      }
      const data = await res.json();
      const items = Array.isArray(data.clips) ? data.clips : [];
      if (items.length === 0) {
        setError("No clips found");
      } else {
        setError(null);
      }
      setClips(items);
    } catch (e) {
      setError((e as Error).message);
      setClips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  if (!backendUrl) return null;

  const up = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ top: -itemHeight, behavior: "smooth" });
  };

  const down = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ top: itemHeight, behavior: "smooth" });
  };

  const LIST_HEIGHT = 2400;

  return (
    <Card className="space-y-2 relative">
      <h2 ref={headerRef} className="text-lg font-semibold">Twitch Clips</h2>
      {loading ? (
        <ul className="space-y-2 pr-1" style={{ height: LIST_HEIGHT }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="space-y-1">
              <Skeleton className="w-full rounded aspect-video" />
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        </ul>
      ) : clips.length === 0 || error ? (
        <div className="flex items-center justify-center" style={{ height: LIST_HEIGHT }}>
          <div className="space-y-2 text-center">
            <p className="text-sm">{error || "No clips found"}</p>
            <Button onClick={fetchClips}>Reload</Button>
          </div>
        </div>
      ) : (
        <>
          <ul
            ref={listRef}
            className="space-y-2 overflow-y-auto scroll-smooth pr-1"
            style={{ height: LIST_HEIGHT }}
          >
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
          <button
            className="absolute bg-gray-300 rounded-full p-1 disabled:opacity-50"
            style={{ top: headerHeight + 8, left: "calc(50% - 8px)" }}
            onClick={up}
            disabled={!canUp}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            className="absolute bg-gray-300 rounded-full p-1 disabled:opacity-50"
            style={{ bottom: 8, left: "calc(50% - 8px)" }}
            onClick={down}
            disabled={!canDown}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </>
      )}
    </Card>
  );
}
