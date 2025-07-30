"use client";

import { useEffect, useState } from "react";

interface LogEntry {
  id: number;
  message: string;
  created_at: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function EventLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

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
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Recent Events</h2>
      <ul className="space-y-1 text-sm">
        {logs.map((l) => (
          <li key={l.id}>
            {new Date(l.created_at).toLocaleTimeString()} - {l.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
