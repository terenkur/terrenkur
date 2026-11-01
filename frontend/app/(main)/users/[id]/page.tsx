"use client";

import { use, useEffect, useState } from "react";
import { profileDetailsEnabled } from "@/lib/features";
import Link from "next/link";
import Image from "next/image";
import { proxiedImage } from "@/lib/utils";
import { INTIM_LABELS, POCELUY_LABELS, TOTAL_LABELS } from "@/lib/statLabels";
import MedalIcon, { MedalType } from "@/components/MedalIcon";
import { useTranslation } from "react-i18next";

interface PollHistory {
  id: number;
  created_at: string;
  archived: boolean;
  winnerId?: number | null;
  winnerName?: string | null;
  winnerBackground?: string | null;
  games: { id: number; name: string }[];
}

interface UserInfo extends Record<string, string | number | boolean | null> {
  id: number;
  username: string;
  twitch_login: string | null;
  total_streams_watched: number;
  total_subs_gifted: number;
  total_subs_received: number;
  total_chat_messages_sent: number;
  total_times_tagged: number;
  total_commands_run: number;
  total_months_subbed: number;
  clips_created: number;
  combo_commands: number;
  votes: number;
  roulettes: number;
}

interface Achievement {
  id: number;
  title: string;
  stat_key: string;
  description: string;
  threshold: number;
  earned_at: string;
}

type UserMedals = Record<string, MedalType | null>;

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;


export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<PollHistory[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [medals, setMedals] = useState<UserMedals>({});
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const STAT_LABELS: Record<string, string> = {
    ...TOTAL_LABELS,
    ...INTIM_LABELS,
    ...POCELUY_LABELS,
    top_voters: t("statsPage.topVoters"),
    top_roulette_users: t("statsPage.topRouletteParticipants"),
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const res = await fetch(`${backendUrl}/api/users/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      let hist: PollHistory[] = (data.history || []).map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        archived: p.archived,
        winnerId: p.winner_id,
        games: p.games,
      }));

      try {
        const gRes = await fetch(`${backendUrl}/api/games`);
        if (gRes.ok) {
          const gData = await gRes.json();
          const gameMap: Record<number, { name: string; background_image: string | null }> = {};
          (gData.games || []).forEach((g: any) => {
            gameMap[g.id] = { name: g.name, background_image: g.background_image };
          });
          hist = hist.map((p) => {
            if (p.winnerId && gameMap[p.winnerId]) {
              return {
                ...p,
                winnerName: gameMap[p.winnerId].name,
                winnerBackground: gameMap[p.winnerId].background_image,
              };
            }
            return p;
          });
        }
      } catch (err) {
        console.error(err);
      }

      if (profileDetailsEnabled) {
        try {
          const [achRes, medRes] = await Promise.all([
            fetch(`${backendUrl}/api/achievements/${id}`),
            fetch(`${backendUrl}/api/medals/${id}`),
          ]);
          if (achRes.ok) {
            const achData = await achRes.json();
            setAchievements(achData.achievements || []);
          }
          if (medRes.ok) {
            const medData = await medRes.json();
            setMedals(medData.medals || {});
          }
        } catch (err) {
          console.error(err);
        }
      }

      setHistory(hist);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const intimStats = user
    ? Object.entries(user).filter(
        ([k, v]) => k.startsWith("intim_") && Number(v) !== 0
      )
    : [];
  const poceluyStats = user
    ? Object.entries(user).filter(
        ([k, v]) => k.startsWith("poceluy_") && Number(v) !== 0
      )
    : [];
  const totalStats = user
    ? Object.entries(user).filter(
        ([k, v]) => k.startsWith("total_") && Number(v) !== 0
      )
    : [];
  const earnedMedals = Object.entries(medals).filter(
    ([, type]) => type !== null
  ) as [string, MedalType][];

  if (!backendUrl) return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  if (loading) return <div className="p-4">{t("loading")}</div>;
  if (!user) return <div className="p-4">{t("userPage.userNotFound")}</div>;

  const supportedWinners = new Set(history.filter(poll =>
    poll.archived && poll.winnerId != null && poll.games.some(game => game.id === poll.winnerId)
  ).map(poll => poll.id));
  const orderedHistory = [...history].sort((a, b) =>
    Number(a.archived) - Number(b.archived) || Date.parse(b.created_at) - Date.parse(a.created_at)
  );

  return (
    <article className="min-w-0 space-y-4">
      <Link href="/users" className="text-sm underline">{t("userPage.backToUsers")}</Link>
      <header className="space-y-3 rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="min-w-0 break-all text-2xl font-semibold">{user.username}</h1>
          <a href={`https://twitch.tv/${user.twitch_login ?? user.username}`} target="_blank"
            rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm underline">
            <Image src="/icons/socials/twitch.svg" alt="" width={16} height={16} />
            Открыть Twitch
          </a>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t pt-2 text-sm tabular-nums">
          <p>{t("statsPage.votes")}: {user.votes}</p>
          <p>{t("statsPage.roulettes")}: {user.roulettes}</p>
          <p>Поддержал победителя: {supportedWinners.size}</p>
        </div>
      </header>
      {profileDetailsEnabled && achievements.length > 0 && (
        <details>
          <summary>{t("userPage.achievements")}</summary>
          <ul className="pl-4 list-disc">
            {achievements.map((a) => (
              <li key={a.id} className="space-y-1">
                <div className="font-medium">{a.title}</div>
                {a.description && (
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {profileDetailsEnabled && earnedMedals.length > 0 && (
        <details>
          <summary>{t("userPage.medals")}</summary>
          <ul className="pl-4 list-disc">
            {earnedMedals.map(([key, type]) => (
              <li key={key} className="flex items-center">
                <MedalIcon type={type} className="mr-1" />
                {STAT_LABELS[key] ?? key}
              </li>
            ))}
          </ul>
        </details>
      )}
      {profileDetailsEnabled && intimStats.length > 0 && (
        <details>
          <summary>{t("statsPage.intims")}</summary>
          <ul className="pl-4 list-disc">
            {intimStats.map(([key, value]) => (
              <li key={key}>
                {INTIM_LABELS[key] ?? key}: {value}
              </li>
            ))}
          </ul>
        </details>
      )}
      {profileDetailsEnabled && poceluyStats.length > 0 && (
        <details>
          <summary>{t("statsPage.kisses")}</summary>
          <ul className="pl-4 list-disc">
            {poceluyStats.map(([key, value]) => (
              <li key={key}>
                {POCELUY_LABELS[key] ?? key}: {value}
              </li>
            ))}
          </ul>
        </details>
      )}
      {profileDetailsEnabled && totalStats.length > 0 && (
        <details>
          <summary>{t("statsPage.title")}</summary>
          <ul className="pl-4 list-disc">
            {totalStats.map(([key, value]) => (
              <li key={key}>
                {TOTAL_LABELS[key] ?? key}: {value}
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">История голосования</h2>
        {history.length === 0 && <p>{t("userPage.noVotesYet")}</p>}
        <ul className="space-y-2">
          {orderedHistory.map(poll => (
            <li key={poll.id} className="space-y-2 rounded-lg border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">
                  <Link href={poll.archived ? `/archive/${poll.id}` : "/"} className="underline">
                    {t("userPage.rouletteFrom", { date: new Date(poll.created_at).toLocaleString("ru-RU") })}
                  </Link>
                </h3>
                {!poll.archived && <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white">{t("userPage.active")}</span>}
                {supportedWinners.has(poll.id) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-950">Поддержал победителя</span>}
              </div>
              <p className="text-sm font-medium">За что голосовал</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {poll.games.map(game => <li key={game.id}>
                  <Link href={`/games/${game.id}`} className="break-words underline">{game.name}</Link>
                </li>)}
              </ul>
              {poll.winnerId != null ? (
                <Link href={`/games/${poll.winnerId}`} className="flex items-center gap-2 border-t pt-2 text-sm underline">
                  {poll.winnerBackground && <img src={proxiedImage(poll.winnerBackground) ?? poll.winnerBackground}
                    alt="" loading="lazy" className="h-9 w-14 rounded object-cover" />}
                  {t("userPage.winnerIs", { name: poll.winnerName ?? poll.games.find(game => game.id === poll.winnerId)?.name ?? `Игра №${poll.winnerId}` })}
                </Link>
              ) : poll.archived && <p className="text-sm text-muted-foreground">Победитель не указан.</p>}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
