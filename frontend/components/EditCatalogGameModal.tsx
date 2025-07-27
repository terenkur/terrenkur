"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";

interface Result {
  rawg_id: number;
  name: string;
  background_image: string | null;
}

interface UserRef {
  id: number;
  username: string;
}

interface GameEntry {
  id: number;
  name: string;
  background_image: string | null;
  status: string;
  rating: number | null;
  selection_method: string | null;
  initiators: UserRef[];
}

interface Props {
  game: GameEntry;
  session: Session | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditCatalogGameModal({
  game,
  session,
  onClose,
  onUpdated,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(game.name);
  const [background, setBackground] = useState<string | null>(game.background_image);
  const [status, setStatus] = useState(game.status);
  const [method, setMethod] = useState(game.selection_method || "");
  const [rating, setRating] = useState<string | number>(game.rating ?? "");
  const [initiators, setInitiators] = useState(
    game.initiators.map((i) => i.username).join(", ")
  );

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

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

  const applyResult = (r: Result) => {
    setName(r.name);
    setBackground(r.background_image);
  };

  const saveGame = async () => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/manage_game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        game_id: game.id,
        name,
        background_image: background,
        status,
        selection_method: method || null,
        rating: status === "completed" && rating !== "" ? Number(rating) : null,
        initiators: initiators
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
      }),
    });
    onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-4 rounded space-y-4 shadow-lg w-96">
        <h2 className="text-xl font-semibold">Edit Game</h2>
        <div className="flex space-x-2">
          <input
            className="border p-1 flex-grow text-black"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={search}>
            Search
          </button>
        </div>
        {background && (
          <img src={background} alt={name} className="w-full h-32 object-cover" />
        )}
        <input
          className="border p-1 w-full text-black"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center space-x-2">
          <label className="text-sm">Status:</label>
          <select
            className="border p-1 flex-grow text-black"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="completed">Completed</option>
            <option value="backlog">Backlog</option>
            <option value="active">Active Roulette</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">Method:</label>
          <select
            className="border p-1 flex-grow text-black"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="">-</option>
            <option value="donation">Donation</option>
            <option value="roulette">Roulette</option>
            <option value="points">Points</option>
          </select>
        </div>
        {status === "completed" && (
          <div className="flex items-center space-x-2">
            <label className="text-sm">Rating:</label>
            <input
              type="number"
              className="border p-1 w-24 text-black"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-center space-x-2">
          <label className="text-sm">Initiators:</label>
          <input
            className="border p-1 flex-grow text-black"
            value={initiators}
            onChange={(e) => setInitiators(e.target.value)}
            placeholder="comma separated"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading && <p>Searching...</p>}
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
              <button
                className="px-2 py-1 bg-purple-600 text-white rounded"
                onClick={() => applyResult(r)}
              >
                Use
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-2">
          <button className="px-2 py-1 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={saveGame}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
