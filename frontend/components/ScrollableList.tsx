"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ScrollableListProps<T> {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  height: number;
}

export default function ScrollableList<T>({
  title,
  items,
  renderItem,
  height,
}: ScrollableListProps<T>) {
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
    const first = list.querySelector("li");
    if (first) {
      setItemHeight(first.clientHeight);
    }
    const update = () => {
      setCanUp(list.scrollTop > 0);
      setCanDown(list.scrollTop + list.clientHeight < list.scrollHeight);
    };
    update();
    list.addEventListener("scroll", update);
    return () => list.removeEventListener("scroll", update);
  }, [items]);

  const up = () => {
    listRef.current?.scrollBy({ top: -itemHeight, behavior: "smooth" });
  };

  const down = () => {
    listRef.current?.scrollBy({ top: itemHeight, behavior: "smooth" });
  };

  return (
    <Card className="space-y-2 relative">
      <h2 ref={headerRef} className="text-lg font-semibold">
        {title}
      </h2>
      <ul
        ref={listRef}
        className="space-y-2 overflow-y-auto scroll-smooth pr-1"
        style={{ height }}
      >
        {items.map((item) => renderItem(item))}
      </ul>
      <Button
        variant="icon"
        size="icon"
        className="absolute p-1 rounded-full h-6 w-6"
        style={{ top: headerHeight + 8, left: "calc(50% - 8px)" }}
        onClick={up}
        disabled={!canUp}
        aria-label="Scroll up"
        title="Scroll up"
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
      </Button>
      <Button
        variant="icon"
        size="icon"
        className="absolute p-1 rounded-full h-6 w-6"
        style={{ bottom: 8, left: "calc(50% - 8px)" }}
        onClick={down}
        disabled={!canDown}
        aria-label="Scroll down"
        title="Scroll down"
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
      </Button>
    </Card>
  );
}
