"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";

interface Game {
  id: number;
  name: string;
  background_image: string | null;
}

interface Props {
  tag: string;
  session: Session | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditPlaylistGameModal({
  tag,
  session,
  onClose,
  onUpdated,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const search = async () => {
    if (!backendUrl) return;
    setLoading(true);
    const resp = await fetch(`${backendUrl}/api/games`);
    if (resp.ok) {
      const data = await resp.json();
      const list: Game[] = data.games || [];
      const q = query.toLowerCase();
      setResults(list.filter((g) => g.name.toLowerCase().includes(q)));
    }
    setLoading(false);
  };

  const setGame = async (g: Game | null) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/playlist_game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tag, game_id: g ? g.id : null }),
    });
    onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-4 rounded space-y-4 shadow-lg w-96">
        <h2 className="text-xl font-semibold">Select Game for #{tag}</h2>
        <div className="flex space-x-2">
          <input
            className="border p-1 flex-grow text-black"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="px-2 py-1 bg-purple-600 text-white rounded"
            onClick={search}
          >
            Search
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading && <p>Searching...</p>}
          {results.map((r) => (
            <div key={r.id} className="flex items-center space-x-2">
              {r.background_image && (
                <img
                  src={r.background_image}
                  alt={r.name}
                  className="w-16 h-9 object-cover"
                />
              )}
              <span className="flex-grow">{r.name}</span>
              <button
                className="px-2 py-1 bg-purple-600 text-white rounded"
                onClick={() => setGame(r)}
              >
                Select
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <button className="px-2 py-1 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-2 py-1 bg-red-500 text-white rounded"
            onClick={() => setGame(null)}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
