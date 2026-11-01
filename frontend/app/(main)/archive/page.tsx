"use client";

import { fetchMyProfile } from "@/lib/profile";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { proxiedImage } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { t } = useTranslation();

  const loadPolls = useCallback(async () => {
    if (!backendUrl) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await fetch(`${backendUrl}/api/polls`);
      if (!res.ok) {
        throw new Error("Failed to fetch polls");
      }
      const data = await res.json();
      const pollsData = ((data.polls || []) as any[]).map((poll) => ({
        id: poll.id,
        created_at: poll.created_at,
        archived: poll.archived,
        winnerId: poll.winner_id ?? null,
        winnerName: poll.winner_name ?? null,
        winnerBackground: poll.winner_background ?? null,
      }));
      setPolls(pollsData);
    } catch (err) {
      console.error("Failed to load polls", err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (!backendUrl) return;

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
  }, [backendUrl, loadPolls]);

  useEffect(() => {
    const checkMod = async () => {
      setIsModerator(false);
      if (!session) return;
      const { data } = await fetchMyProfile(session);
      setIsModerator(!!data?.is_moderator);
    };
    checkMod();
  }, [session]);

  if (!backendUrl) {
    return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  }

  const archivedPolls = polls.filter((p) => p.archived);
  const showEmptyState = !isLoading && !hasError && archivedPolls.length === 0;

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("rouletteArchive")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="rounded-md border px-3 py-2 text-sm font-medium hover:underline">
            {t("goToActiveRoulette")}
          </Link>
          {isModerator && (
            <Link href="/new-poll" className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:underline">
              {t("newRoulette")}
            </Link>
          )}
        </div>
      </header>
      {hasError && (
        <div className="border border-red-500 bg-red-50 text-red-700 p-4 rounded">
          <p>{t("archiveLoadFailed")}</p>
          <button
            type="button"
            onClick={loadPolls}
            className="mt-2 inline-flex items-center rounded border border-red-500 px-3 py-1 text-sm font-medium"
          >
            {t("retry")}
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {isLoading &&
          Array.from({ length: 3 }).map((_, idx) => (
            <li key={`poll-skeleton-${idx}`} className="border p-2 rounded-lg">
              <Skeleton className="mb-2 h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </li>
          ))}
        {showEmptyState && (
          <li className="p-4 text-center text-muted-foreground border rounded">
            {t("archiveEmpty")}
          </li>
        )}
        {archivedPolls.map((poll) => {
          const dateLabel = t("rouletteFrom", { date: new Date(poll.created_at).toLocaleDateString("ru-RU") });
          const cover = proxiedImage(poll.winnerBackground);
          return (
            <li key={poll.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
              <Link href={`/archive/${poll.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded">
                {cover && (
                  <img src={cover} alt="" loading="lazy" width={96} height={54}
                    className="aspect-video w-16 shrink-0 rounded object-cover sm:w-24" />
                )}
                <div className="min-w-0">
                  <h2 className="break-words font-semibold group-hover:underline">
                    {poll.winnerName || dateLabel}
                  </h2>
                  {poll.winnerName && (
                    <time dateTime={poll.created_at} className="text-sm text-muted-foreground">{dateLabel}</time>
                  )}
                </div>
              </Link>
              {poll.winnerId != null && (
                <Link href={`/games/${poll.winnerId}`} className="rounded px-2 py-1 text-sm underline underline-offset-2">
                  {t("archiveAboutGame")}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
