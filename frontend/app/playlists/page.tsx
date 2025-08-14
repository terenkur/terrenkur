"use client";

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
  const [data, setData] = useState<Record<string, PlaylistEntry>>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { t } = useTranslation();

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
      const { data } = await supabase
        .from("users")
        .select("is_moderator")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      setIsModerator(!!data?.is_moderator);
    };
    checkMod();
  }, [session]);

  if (!backendUrl) return <div className="p-4">{t("backendUrlMissing")}</div>;
  if (loading) return <div className="p-4">{t("loading")}</div>;

  const tags = Object.keys(data)
    .sort()
    .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <main className="col-span-12 md:col-span-9 p-4 space-y-6">
        <h1 className="text-2xl font-semibold">{t("playlists")}</h1>
        <div>
          <label htmlFor="playlist-search" className="sr-only">
            {t("searchHashtags")}
          </label>
          <input
            id="playlist-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchHashtags")}
            className="border p-1 rounded w-full text-black"
          />
        </div>
        {tags.map((tag) => (
          <PlaylistRow
            key={tag}
            tag={tag}
            videos={data[tag].videos}
            game=
              {data[tag].game
                ? {
                    id: data[tag].game.id,
                    name: data[tag].game.name,
                    background_image: data[tag].game.background_image,
                  }
                : null}
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
