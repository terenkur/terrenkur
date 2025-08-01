"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface LogEntry {
  id: number;
  message: string;
  created_at: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function EventLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
  }, [logs]);

  useEffect(() => {
    if (!backendUrl) return;

    const fetchLogs = () => {
      fetch(`${backendUrl}/api/logs?limit=10`).then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setLogs((data.logs || []) as LogEntry[]);
      });
    };

    fetchLogs();
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, []);

  if (!backendUrl) return null;

  return (
    <Card className="space-y-2 relative">
      <h2 ref={headerRef} className="text-lg font-semibold">Recent Events</h2>
      <ul
        ref={listRef}
        className="space-y-2 text-sm overflow-y-auto scroll-smooth pr-1"
        style={{ maxHeight: itemHeight ? itemHeight * 8 : 1600 }}
      >
        {logs.map((l) => (
          <li
            key={l.id}
            className="bg-muted rounded border p-2"
          >
            {new Date(l.created_at).toLocaleTimeString()} - {l.message}
          </li>
        ))}
      </ul>
      <button
        className="absolute left-1/2 -translate-x-1/2 bg-gray-300 rounded-full p-1 disabled:opacity-50"
        style={{ top: headerHeight }}
        onClick={() => listRef.current?.scrollBy({ top: -itemHeight, behavior: 'smooth' })}
        disabled={!canUp}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
      </button>
      <button
        className="absolute left-1/2 -translate-x-1/2 bg-gray-300 rounded-full p-1 disabled:opacity-50"
        style={{ bottom: 0 }}
        onClick={() => listRef.current?.scrollBy({ top: itemHeight, behavior: 'smooth' })}
        disabled={!canDown}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </Card>
  );
}
