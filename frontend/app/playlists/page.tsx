"use client";

import { useEffect, useState } from "react";

interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail?: string;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function PlaylistsPage() {
  const [data, setData] = useState<Record<string, Video[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/playlists`).then(async (res) => {
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const d = await res.json();
      setData(d || {});
      setLoading(false);
    });
  }, []);

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;

  const tags = Object.keys(data).sort();

  return (
    <main className="col-span-10 p-4 max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Playlists</h1>
      {tags.map((tag) => (
        <section key={tag} className="space-y-2">
          <h2 className="text-xl font-medium">#{tag}</h2>
          <ul className="pl-4 list-disc space-y-1">
            {data[tag].map((v) => (
              <li key={v.id}>
                <a
                  className="text-purple-600 underline"
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {v.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
