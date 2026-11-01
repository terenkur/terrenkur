"use client";

import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { proxiedImage } from "@/lib/utils";
import PlaylistRow, { Video } from "@/components/PlaylistRow";

interface UserRef {
  id: number;
  username: string;
  count?: number;
}

interface PollInfo {
  id: number;
  created_at: string;
  archived: boolean;
  voters: UserRef[];
  winnerId?: number | null;
  winnerName?: string | null;
  winnerBackground?: string | null;
}

interface GameInfo {
  id: number;
  name: string;
  background_image: string | null;
  status: string;
  rating: number | null;
  selection_method: string | null;
  released_year: number | null;
  genres: string[] | null;
  initiators: UserRef[];
  votes: number;
  roulettes: number;
}

interface PlaylistData {
  tag: string;
  videos: Video[];
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);

  const statusLabels: Record<string, string> = {
    active: t("statusActive"),
    completed: t("statusCompleted"),
    backlog: t("statusBacklog"),
  };
  const methodLabels: Record<string, string> = {
    donation: t("methodDonation"),
    roulette: t("methodRoulette"),
    points: t("methodPoints"),
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl) return;
      const res = await fetch(`${backendUrl}/api/games/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setGame(data.game);
      setPolls(data.polls || []);
      setPlaylist(data.playlist || null);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (!backendUrl)
    return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  if (loading) return <div className="p-4">{t("loading")}</div>;
  if (!game) return <div className="p-4">{t("gameNotFound")}</div>;

  const orderedPolls = [...polls].sort((a, b) =>
    Number(a.archived) - Number(b.archived) || Date.parse(b.created_at) - Date.parse(a.created_at)
  );
  const wins = polls.filter(poll => poll.winnerId === game.id).length;
  const cover = proxiedImage(game.background_image);

  return (
    <article className="min-w-0 space-y-4">
      <Link href="/games" className="text-sm underline">{t("backToGames")}</Link>
      <header className="space-y-3 rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-start gap-4">
          {cover && <img src={cover} alt="" width={144} height={81}
            className="aspect-video w-28 rounded object-cover sm:w-36" />}
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="break-words text-2xl font-semibold">{game.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border px-2 py-0.5">{statusLabels[game.status] ?? game.status}</span>
              {game.rating != null && <span>{t("rating")}: {game.rating}/10</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {game.released_year && <span>{t("released")}: {game.released_year}</span>}
          {!!game.genres?.length && <span>{t("genres")}: {game.genres.join(", ")}</span>}
          {game.selection_method && <span>{t("selection")}: {methodLabels[game.selection_method] ?? game.selection_method}</span>}
        </div>
        {game.initiators.length > 0 && <p className="flex flex-wrap gap-x-2 text-sm">
          {t("initiators")} {game.initiators.map(user => (
            <Link key={user.id} href={`/users/${user.id}`} className="break-all underline">{user.username}</Link>
          ))}
        </p>}
        <p className="border-t pt-2 text-sm tabular-nums">
          {t("votes")}: {game.votes} · {t("roulettes")}: {game.roulettes} · Побед: {wins}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Участие в рулетках</h2>
        {!polls.length && <p>{t("noRoulettesYet")}</p>}
        <ul className="space-y-2">
          {orderedPolls.map(poll => {
            const won = poll.winnerId === game.id;
            const votes = poll.voters.reduce((sum, voter) => sum + (voter.count ?? 0), 0);
            return (
              <li key={poll.id} className={`space-y-2 rounded-lg border bg-background p-3 ${won ? "border-amber-400" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={poll.archived ? `/archive/${poll.id}` : "/"} className="font-semibold underline">
                    {t("rouletteFrom", { date: new Date(poll.created_at).toLocaleString("ru-RU") })}
                  </Link>
                  {!poll.archived && <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white">{t("active")}</span>}
                  {won && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">Победа</span>}
                </div>
                {!won && poll.winnerId != null && <p className="text-sm">Победитель —{" "}
                  <Link href={`/games/${poll.winnerId}`} className="underline">{poll.winnerName || `Игра №${poll.winnerId}`}</Link>
                </p>}
                {poll.archived && poll.winnerId == null && <p className="text-sm text-muted-foreground">Победитель не указан.</p>}
                <p className="text-sm">Голосов за игру: {votes}</p>
                {poll.voters.length > 0 && <details className="border-t pt-2 text-sm">
                  <summary className="cursor-pointer">{t("pollCard.voters")}</summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {poll.voters.map(user => <li key={user.id}>
                      <Link href={`/users/${user.id}`} className="break-all underline">{user.username}</Link> · {user.count}
                    </li>)}
                  </ul>
                </details>}
              </li>
            );
          })}
        </ul>
      </section>
      {playlist && (
        <PlaylistRow
          tag={playlist.tag}
          videos={playlist.videos}
          game={{
            id: game.id,
            name: game.name,
            background_image: game.background_image,
          }}
          isModerator={false}
          onEdit={() => {}}
        />
      )}
    </article>
  );
}
