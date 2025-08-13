"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";

interface LogEntry {
  id: number;
  message: string;
  created_at: string;
  media_url?: string;
  preview_url?: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function EventLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const headerRef = useRef<HTMLHeadingElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const [itemHeight, setItemHeight] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

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

    const fetchLogs = async () => {
      const token = session?.access_token;
      try {
        const res = await fetch(`${backendUrl}/api/logs?limit=10`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          setError("Failed to fetch logs");
          return;
        }
        const data = await res.json();
        setError(null);
        setLogs((data.logs || []) as LogEntry[]);
      } catch {
        setError("Failed to fetch logs");
      }
    };

    fetchLogs();
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, [session]);

  if (!backendUrl) return null;

  return (
    <Card className="space-y-2 relative">
      <h2 ref={headerRef} className="text-lg font-semibold">Recent Events</h2>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <ul
        ref={listRef}
        className="space-y-2 text-sm overflow-y-auto scroll-smooth pr-1"
        style={{ maxHeight: itemHeight ? itemHeight * 4.8 : 960 }}
      >
        {logs.map((l) => (
          <li
            key={l.id}
            className="bg-muted rounded border p-2"
          >
            {new Date(l.created_at).toLocaleTimeString()} - {l.message}
            {l.preview_url && l.media_url && (
              <a href={l.media_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={l.preview_url}
                  alt={l.message}
                  className="mt-2 max-w-full"
                />
              </a>
            )}
          </li>
        ))}
      </ul>
      <button
        className="absolute bg-gray-300 rounded-full p-1 disabled:opacity-50"
        style={{ top: headerHeight + 8, left: "calc(50% - 8px)" }}
        onClick={() => listRef.current?.scrollBy({ top: -itemHeight, behavior: 'smooth' })}
        disabled={!canUp}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
      </button>
      <button
        className="absolute bg-gray-300 rounded-full p-1 disabled:opacity-50"
        style={{ bottom: 8, left: "calc(50% - 8px)" }}
        onClick={() => listRef.current?.scrollBy({ top: itemHeight, behavior: 'smooth' })}
        disabled={!canDown}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </Card>
  );
}
