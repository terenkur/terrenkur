"use client";

import { useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";

interface Result {
  rawg_id: number;
  name: string;
  background_image: string | null;
}

interface Props {
  pollId?: number;
  session: Session | null;
  onClose: () => void;
  onAdded?: () => void;
  onSelect?: (result: Result) => void;
}

export default function AddGameModal({ pollId, session, onClose, onAdded, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const search = async () => {
    if (!backendUrl || !query.trim()) return;
    setLoading(true);
    const resp = await fetch(
      `${backendUrl}/api/rawg_search?query=${encodeURIComponent(query)}`
    );
    if (resp.ok) {
      const data = await resp.json();
      setResults(data.results || []);
    }
    setLoading(false);
  };

  const addGame = async (g: Result) => {
    if (!backendUrl) return;
    if (pollId === undefined && onSelect) {
      onSelect(g);
      onClose();
      return;
    }
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        poll_id: pollId,
        rawg_id: g.rawg_id,
        name: g.name,
        background_image: g.background_image,
      }),
    });
    onAdded && onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background text-foreground p-4 rounded space-y-4 shadow-lg w-96">
        <h2 className="text-xl font-semibold">{t('addGame')}</h2>
        <div className="flex space-x-2">
          <input
            className="border p-1 flex-grow text-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={search}>
            {t('search')}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading && <p>{t('searching')}</p>}
          {results.map((r) => (
            <div key={r.rawg_id} className="flex items-center space-x-2">
              {r.background_image && (
                <Image
                  src={r.background_image}
                  alt={r.name}
                  width={64}
                  height={36}
                  className="w-16 h-9 object-cover"
                  loading="lazy"
                />
              )}
              <span className="flex-grow">{r.name}</span>
              <button
                className="px-2 py-1 bg-purple-600 text-white rounded"
                onClick={() => addGame(r)}
              >
                {t('add')}
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button className="px-2 py-1 bg-muted rounded" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
