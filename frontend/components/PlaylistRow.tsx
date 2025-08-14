import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { proxiedImage, cn } from "@/lib/utils";

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
  background_image: string | null;
}

export interface PlaylistRowProps {
  tag: string;
  videos: Video[];
  game: GameRef | null;
  isModerator: boolean;
  onEdit: () => void;
}

export default function PlaylistRow({
  tag,
  videos,
  game,
  isModerator,
  onEdit,
}: PlaylistRowProps) {
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
    const first = list.querySelector("li");
    if (first) {
      const style = window.getComputedStyle(first);
      const width = first.clientWidth + parseInt(style.marginRight || "0");
      setItemWidth(width);
    }
    const update = () => {
      setCanLeft(list.scrollLeft > 0);
      setCanRight(list.scrollLeft + list.clientWidth < list.scrollWidth);
    };
    update();
    list.addEventListener("scroll", update);
    return () => list.removeEventListener("scroll", update);
  }, [videos]);

  const left = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ left: -itemWidth, behavior: "smooth" });
  };

  const right = () => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ left: itemWidth, behavior: "smooth" });
  };

  return (
    <section className="relative">
      <Card
        className={cn(
          "space-y-2 p-2 relative overflow-hidden",
          game?.background_image ? "bg-muted" : "bg-gray-700"
        )}
      >
        {game?.background_image && (
          <>
            <div className="absolute inset-0 bg-black/80 z-0" />
            <div
              className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
              style={{
                backgroundImage: `url(${proxiedImage(game.background_image)})`,
              }}
            />
          </>
        )}
        <div
          ref={headerRef}
          className="flex items-center justify-between relative z-10"
        >
          <h2
            className={cn(
              "text-xl font-medium",
              game?.background_image && "text-white"
            )}
          >
            {game ? (
              <Link
                href={`/games/${game.id}`}
                className={cn(
                  "underline",
                  game.background_image ? "text-white" : "text-purple-600"
                )}
              >
                {game.name}
              </Link>
            ) : (
              `#${tag}`
            )}
          </h2>
          <div className="flex items-center space-x-2 text-sm">
            {!game && <span className="text-gray-500">No game</span>}
            {isModerator && (
              <button
                className={cn(
                  "underline",
                  game?.background_image ? "text-white" : "text-purple-600"
                )}
                onClick={onEdit}
              >
                Изменить игру
              </button>
            )}
          </div>
        </div>
        <ul
          ref={listRef}
          className="flex space-x-2 overflow-x-auto scroll-smooth pb-1 relative z-10"
        >
          {videos.map((v) => {
            const src = proxiedImage(v.thumbnail) ?? v.thumbnail;

            return (
              <li key={v.id} className="space-y-1 flex-shrink-0 w-48">
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={v.title}
                      width={320}
                      height={180}
                      className="w-full rounded"
                      loading="lazy"
                    />
                  ) : null}
                  <p
                    className={cn(
                      "text-sm",
                      game?.background_image && "text-white"
                    )}
                  >
                    {v.title}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
        <button
          className="absolute top-1/2 -translate-y-1/2 bg-gray-300 rounded-full p-1 disabled:opacity-50 z-10"
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
          className="absolute top-1/2 -translate-y-1/2 bg-gray-300 rounded-full p-1 disabled:opacity-50 z-10"
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
