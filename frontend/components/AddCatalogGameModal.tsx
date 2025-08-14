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
  session: Session | null;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddCatalogGameModal({ session, onClose, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("backlog");
  const [method, setMethod] = useState("");
  const [rating, setRating] = useState<string | number>("");
  const [initiators, setInitiators] = useState("");
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
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
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/manage_game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        rawg_id: g.rawg_id,
        name: g.name,
        background_image: g.background_image,
        status,
        selection_method: method || null,
        rating: status === "completed" && rating !== "" ? Number(rating) : null,
        initiators: initiators
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
      }),
    });
    onAdded();
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
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('status')}:</label>
          <select
            className="border p-1 flex-grow text-foreground"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="completed">{t('statusCompleted')}</option>
            <option value="backlog">{t('statusBacklog')}</option>
            <option value="active">{t('statusActive')}</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('method')}:</label>
          <select
            className="border p-1 flex-grow text-foreground"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="">-</option>
            <option value="donation">{t('methodDonation')}</option>
            <option value="roulette">{t('methodRoulette')}</option>
            <option value="points">{t('methodPoints')}</option>
          </select>
        </div>
        {status === "completed" && (
          <div className="flex items-center space-x-2">
            <label className="text-sm">{t('rating')}:</label>
            <input
              type="number"
              className="border p-1 w-24 text-foreground"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('initiators')}</label>
          <input
            className="border p-1 flex-grow text-foreground"
            value={initiators}
            onChange={(e) => setInitiators(e.target.value)}
            placeholder={t('commaSeparated')}
          />
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
