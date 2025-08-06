"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

interface Game {
  id: number;
  rawg_id: number | null;
  name: string;
  background_image: string | null;
}

interface Result {
  rawg_id: number;
  name: string;
  background_image: string | null;
  exists: boolean;
  game_id?: number;
}

type GameSelection = Result | null;

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
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [gameMap, setGameMap] = useState<Map<string, Game>>(new Map());
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    if (!backendUrl) return;
    (async () => {
      const resp = await fetch(`${backendUrl}/api/games`);
      if (resp.ok) {
        const data = await resp.json();
        const map = new Map<string, Game>();
        const list: Game[] = data.games || [];
        list.forEach((g) => {
          if (g.rawg_id !== null && g.rawg_id !== undefined) {
            map.set(`r${g.rawg_id}`, g);
          }
          map.set(`n${g.name.toLowerCase()}`, g);
        });
        setGameMap(map);
      }
    })();
  }, [backendUrl]);

  const search = async () => {
    if (!backendUrl || !query.trim()) return;
    setLoading(true);
    setSearched(true);
    const resp = await fetch(
      `${backendUrl}/api/rawg_search?query=${encodeURIComponent(query)}`
    );
    if (resp.ok) {
      const data = await resp.json();
      const list: Result[] = (data.results || []).map((r: any) => {
        const existing =
          gameMap.get(`r${r.rawg_id}`) || gameMap.get(`n${r.name.toLowerCase()}`);
        return {
          rawg_id: r.rawg_id,
          name: r.name,
          background_image: r.background_image,
          exists: !!existing,
          game_id: existing?.id,
        };
      });
      setResults(list);
    }
    setLoading(false);
  };

  const setGame = async (g: GameSelection) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    const body: Record<string, any> = { tag };
    if (g === null) {
      body.game_id = null;
    } else if (g.exists && g.game_id) {
      body.game_id = g.game_id;
    } else {
      body.game_name = g.name;
      body.rawg_id = g.rawg_id;
      if (g.background_image) body.background_image = g.background_image;
    }
    await fetch(`${backendUrl}/api/playlist_game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
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
          {!loading && searched && results.length === 0 && (
            <p>No results</p>
          )}
          {results.map((r) => (
            <div key={r.rawg_id} className="flex items-center space-x-2">
              {r.background_image && (
                <img
                  src={r.background_image}
                  alt={r.name}
                  className="w-16 h-9 object-cover"
                />
              )}
              <span className="flex-grow">{r.name}</span>
              <span className="text-sm">{r.exists ? "Уже в базе" : "Новая"}</span>
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
