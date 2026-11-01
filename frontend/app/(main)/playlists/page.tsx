"use client";

import { fetchMyProfile } from "@/lib/profile";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import EditPlaylistGameModal from "@/components/EditPlaylistGameModal";
import PlaylistRow, { GameRef, Video } from "@/components/PlaylistRow";

interface PlaylistEntry {
  videos: Video[];
  game: GameRef | null;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function PlaylistsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, PlaylistEntry>>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchData = async () => {
    if (!backendUrl) return;
    setLoading(true);
    const res = await fetch(`${backendUrl}/api/playlists`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const d = await res.json();
    setData(d || {});
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkMod = async () => {
      setIsModerator(false);
      if (!session) return;
      const { data } = await fetchMyProfile(session);
      setIsModerator(!!data?.is_moderator);
    };
    checkMod();
  }, [session]);

  if (!backendUrl) return <div className="p-4">{t("backendUrlMissing")}</div>;
  if (loading) return <div className="p-4">{t("loading")}</div>;

  const term = query.trim().toLowerCase();
  const playlists = Object.keys(data).sort().flatMap(tag => {
    const { game, videos } = data[tag];
    if (!term || `#${tag}`.toLowerCase().includes(term) || game?.name.toLowerCase().includes(term)) {
      return [{ tag, game, videos }];
    }
    const matches = videos.filter(video => video.title.toLowerCase().includes(term));
    if (!matches.length) return [];
    return [{ tag, game, videos: [...matches, ...videos.filter(video => !video.title.toLowerCase().includes(term))] }];
  });

  return (
    <>
      <main className="col-span-12 md:col-span-9 p-4 space-y-6">
        <h1 className="text-2xl font-semibold">{t("playlists")}</h1>
        <div>
          <label htmlFor="playlist-search" className="sr-only">
            {t("playlistSearch")}
          </label>
          <input
            id="playlist-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("playlistSearch")}
            className="w-full rounded border bg-background p-2 text-foreground"
          />
        </div>
        <p role="status" className="text-sm text-muted-foreground">Плейлистов: {playlists.length}</p>
        {term && playlists.length === 0 && <div className="space-y-2 rounded-lg border p-3">
          <p>Ничего не найдено.</p>
          <button onClick={() => setQuery("")} className="underline">Очистить поиск</button>
        </div>}
        {playlists.map(({ tag, game, videos }) => (
          <PlaylistRow
            key={tag}
            tag={tag}
            videos={videos}
            game={game}
            isModerator={isModerator}
            onEdit={() => setEditingTag(tag)}
          />
        ))}
      </main>
      {editingTag && (
        <EditPlaylistGameModal
          tag={editingTag}
          session={session}
          onClose={() => setEditingTag(null)}
          onUpdated={fetchData}
        />
      )}
    </>
  );
}
