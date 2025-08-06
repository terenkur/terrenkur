import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail?: string;
}

export interface GameRef {
  id: number;
  name: string;
}

export default function PlaylistRow({
  tag,
  videos,
  game,
  isModerator,
  onEdit,
}: {
  tag: string;
  videos: Video[];
  game: GameRef | null;
  isModerator: boolean;
  onEdit: () => void;
}) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [itemWidth, setItemWidth] = useState(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

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
      const style = window.getComputedStyle(first);
      const width = first.clientWidth + parseInt(style.marginRight || '0');
      setItemWidth(width);
    }
    const update = () => {
      setCanLeft(list.scrollLeft > 0);
      setCanRight(list.scrollLeft + list.clientWidth < list.scrollWidth);
    };
    update();
    list.addEventListener('scroll', update);
    return () => list.removeEventListener('scroll', update);
  }, [videos]);

  const left = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ left: -itemWidth, behavior: 'smooth' });
  };

  const right = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ left: itemWidth, behavior: 'smooth' });
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  return (
    <section className="relative">
      <Card className="space-y-2 relative">
        <div ref={headerRef} className="flex items-center justify-between">
          <h2 className="text-xl font-medium">#{tag}</h2>
          <div className="flex items-center space-x-2 text-sm">
            {game ? (
              <Link
                href={`/games/${game.id}`}
                className="text-purple-600 underline"
              >
                {game.name}
              </Link>
            ) : (
              <span className="text-gray-500">No game</span>
            )}
            {isModerator && (
              <button className="underline" onClick={onEdit}>
                Изменить игру
              </button>
            )}
          </div>
        </div>
        <ul
          ref={listRef}
          className="flex space-x-2 overflow-x-auto scroll-smooth pb-1"
        >
          {videos.map((v) => {
            const src =
              v.thumbnail && v.thumbnail.startsWith("http") && backendUrl
                ? `${backendUrl}/api/proxy?url=${encodeURIComponent(v.thumbnail)}`
                : v.thumbnail;
            return (
              <li key={v.id} className="space-y-1 flex-shrink-0 w-48">
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {src ? (
                    <img src={src} alt={v.title} className="w-full rounded" />
                  ) : null}
                  <p className="text-sm">{v.title}</p>
                </a>
              </li>
            );
          })}
        </ul>
        <button
          className="absolute top-1/2 -translate-y-1/2 bg-gray-300 rounded-full p-1 disabled:opacity-50"
          style={{ left: 0, marginTop: headerHeight / 2 }}
          onClick={left}
          disabled={!canLeft}
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          className="absolute top-1/2 -translate-y-1/2 bg-gray-300 rounded-full p-1 disabled:opacity-50"
          style={{ right: 0, marginTop: headerHeight / 2 }}
          onClick={right}
          disabled={!canRight}
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
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </Card>
    </section>
  );
}
