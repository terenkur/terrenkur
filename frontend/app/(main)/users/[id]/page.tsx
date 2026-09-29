"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { proxiedImage, cn } from "@/lib/utils";
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

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <Link href="/users" className="text-purple-600 underline">
        {t("userPage.backToUsers")}
      </Link>
      <h1 className="text-2xl font-semibold flex items-center space-x-2">
        <a
          href={`https://twitch.tv/${user.twitch_login ?? user.username}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/icons/socials/twitch.svg"
            alt="Twitch"
            width={16}
            height={16}
            className="inline-block h-[1em] w-[1em]"
            priority
          />
        </a>
        <span>{user.username}</span>
      </h1>
      <div className="border rounded-lg relative overflow-hidden p-4 space-y-1 bg-muted">
        <p>
          {t("statsPage.votes")}: {user.votes}
        </p>
        <p>
          {t("statsPage.roulettes")}: {user.roulettes}
        </p>
      </div>
      {achievements.length > 0 && (
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
      {earnedMedals.length > 0 && (
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
      {intimStats.length > 0 && (
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
      {poceluyStats.length > 0 && (
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
      {totalStats.length > 0 && (
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
      {history.length === 0 ? (
        <p>{t("userPage.noVotesYet")}</p>
      ) : (
        <ul className="space-y-2">
          {history.map((poll) => (
            <li
              key={poll.id}
              className={cn(
                "border p-2 rounded-lg space-y-1 relative overflow-hidden",
                poll.archived && poll.winnerBackground ? "bg-muted" : "bg-gray-700",
                !poll.archived && "border-2 border-purple-600"
              )}
            >
              {poll.archived && poll.winnerBackground && (
                <>
                  <div className="absolute inset-0 bg-black/80 z-0" />
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
                    style={{
                      backgroundImage: `url(${proxiedImage(poll.winnerBackground)})`,
                    }}
                  />
                </>
              )}
              <div className="relative z-10 text-white space-y-1">
                <h2 className="font-semibold">
                  <Link
                    href={`/archive/${poll.id}`}
                    className={cn(
                      "underline",
                      poll.archived && poll.winnerBackground
                        ? "text-white"
                        : "text-purple-600"
                    )}
                  >
                    {t("userPage.rouletteFrom", {
                      date: new Date(poll.created_at).toLocaleString(),
                    })}
                  </Link>
                </h2>
                {poll.winnerName && poll.winnerId && (
                  <Link
                    href={`/games/${poll.winnerId}`}
                    className={cn(
                      "text-sm underline",
                      poll.archived && poll.winnerBackground
                        ? "text-white"
                        : "text-purple-600"
                    )}
                  >
                    {t("userPage.winnerIs", { name: poll.winnerName })}
                  </Link>
                )}
                <ul className="pl-4 list-disc">
                  {poll.games.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/games/${g.id}`}
                        className={cn(
                          "underline",
                          poll.archived && poll.winnerBackground
                            ? "text-white"
                            : "text-purple-600"
                        )}
                      >
                        {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {!poll.archived && (
                <span className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-purple-600 text-white rounded">
                  {t("userPage.active")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
