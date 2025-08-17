"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ScrollableList from "@/components/ScrollableList";
import { useTranslation } from "react-i18next";

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
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

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


  const fetchLogs = async () => {
    if (!backendUrl) return;
    const token = session?.access_token;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/logs?limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        throw new Error();
      }
      const data = await res.json();
      const items = (data.logs || []) as LogEntry[];
      if (items.length === 0) {
        setError(t('noEventsFound'));
        setLogs([]);
      } else {
        setError(null);
        setLogs(items);
      }
    } catch {
      setError(t('failedToFetchLogs'));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, [session]);

  if (!backendUrl) return null;

  const LIST_HEIGHT = 500;
  if (loading) {
    return (
      <Card variant="shadow" className="space-y-2 relative">
        <h2 className="text-lg font-semibold">{t('recentEvents')}</h2>
        <ul className="space-y-2 text-sm pr-1" style={{ height: LIST_HEIGHT }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="bg-muted rounded border p-2">
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (logs.length === 0 || error) {
    return (
      <Card variant="shadow" className="space-y-2 relative">
        <h2 className="text-lg font-semibold">{t('recentEvents')}</h2>
        <div
          className="flex items-center justify-center"
          style={{ height: LIST_HEIGHT }}
        >
          <div className="space-y-2 text-center">
            <p className="text-sm">{error || t('noEventsFound')}</p>
            <Button onClick={fetchLogs}>{t('reload')}</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <ScrollableList
      title={t('recentEvents')}
      items={logs}
      height={LIST_HEIGHT}
      renderItem={(l) => (
        <li key={l.id} className="bg-muted rounded border p-2">
          {new Date(l.created_at).toLocaleTimeString()} - {l.message}
          {l.preview_url && l.media_url && (
            <a href={l.media_url} target="_blank" rel="noopener noreferrer">
              <Image
                src={l.preview_url}
                alt={l.message}
                width={320}
                height={180}
                className="mt-2 w-full h-auto"
                loading="lazy"
              />
            </a>
          )}
        </li>
      )}
    />
  );
}
