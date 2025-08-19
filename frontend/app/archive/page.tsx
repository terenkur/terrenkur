"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { proxiedImage, cn } from "@/lib/utils";
import type { Session } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";

interface PollInfo {
  id: number;
  created_at: string;
  archived: boolean;
  winnerName?: string | null;
  winnerId?: number | null;
  winnerBackground?: string | null;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ArchivePage() {
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!backendUrl) return;
    const loadPolls = async () => {
      const res = await fetch(`${backendUrl}/api/polls`);
      if (!res.ok) return;
      const data = await res.json();
      const pollsData = (data.polls || []) as PollInfo[];

      // Fetch mapping of game id to name and background for winner lookups
      const gameMap: Record<
        number,
        { name: string; background_image: string | null }
      > = {};
      const gamesRes = await fetch(`${backendUrl}/api/games`);
      if (gamesRes.ok) {
        const gdata = await gamesRes.json();
        (gdata.games || []).forEach(
          (g: { id: number; name: string; background_image: string | null }) => {
            gameMap[g.id] = {
              name: g.name,
              background_image: g.background_image,
            };
          }
        );
      }

      const withWinners = await Promise.all(
        pollsData.map(async (p) => {
          try {
            const r = await fetch(`${backendUrl}/api/poll/${p.id}/result`);
            if (r.status === 404) {
              // Missing poll_results is normal and doesn't indicate an error
              return { ...p } as PollInfo;
            }
            if (!r.ok) {
              console.warn("Failed to fetch poll result", r.statusText);
              return { ...p } as PollInfo;
            }
            const text = await r.text();
            if (!text) {
              return { ...p } as PollInfo;
            }
            let rdata: any;
            try {
              rdata = JSON.parse(text);
            } catch (err) {
              console.error("Failed to parse poll result", err);
              return { ...p } as PollInfo;
            }
            if (typeof rdata?.winner_id === "number") {
              const winnerId = rdata.winner_id as number;
              const winnerEntry = gameMap[winnerId];
              const winnerName = winnerEntry?.name || null;
              const winnerBackground = winnerEntry?.background_image || null;
              return { ...p, winnerId, winnerName, winnerBackground } as PollInfo;
            }
            return { ...p } as PollInfo;
          } catch (err) {
            console.error(err);
            return { ...p } as PollInfo;
          }
        })
      );

      setPolls(withWinners);
    };

    loadPolls();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, sess) => {
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

  if (!backendUrl) {
    return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  }

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">{t("archiveTitle")}</h1>
      <ul className="space-y-2">
        <li className="border-2 border-purple-600 p-2 rounded-lg bg-purple-50">
          <Link href="/" className="block text-purple-600 underline font-semibold">
            {t("goToActive")}
          </Link>
        </li>
        {isModerator && (
          <li>
            <Link
              href="/new-poll"
              className="px-2 py-1 bg-purple-600 text-white rounded inline-block"
            >
              {t("newRoulette")}
            </Link>
          </li>
        )}
        {polls
          .filter((p) => p.archived)
          .map((p) => (
            <li
              key={p.id}
              className={cn(
                "border p-2 rounded-lg relative overflow-hidden",
                p.winnerBackground ? "bg-gray-700" : "bg-muted"
              )}
            >
              {p.winnerBackground && (
                <>
                  <div className="absolute inset-0 bg-black/80 z-0" />
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
                    style={{
                      backgroundImage: `url(${proxiedImage(p.winnerBackground)})`,
                    }}
                  />
                </>
              )}
              <div className="relative z-10 text-white space-y-1">
                <Link
                  href={`/archive/${p.id}`}
                  className={cn(
                    "block underline",
                    p.winnerBackground ? "text-white" : "text-purple-600"
                  )}
                >
                  {t("rouletteFrom", {
                    date: new Date(p.created_at).toLocaleDateString(),
                  })}
                </Link>
                {p.winnerName && p.winnerId && (
                  <Link
                    href={`/games/${p.winnerId}`}
                    className={cn(
                      "block text-sm underline",
                      p.winnerBackground ? "text-white" : "text-purple-600"
                    )}
                  >
                    {t("winnerIs", { name: p.winnerName })}
                  </Link>
                )}
              </div>
            </li>
          ))}
      </ul>
    </main>
  );
}
