"use client";

import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { proxiedImage, cn } from "@/lib/utils";
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

  const renderUsers = (list: UserRef[], linkClass: string) => (
    <span className="space-x-1">
      {list.map((u, i) => (
        <Link
          key={u.id}
          href={`/users/${u.id}`}
          className={cn("underline", linkClass)}
        >
          {u.username}
          {u.count ? ` (${u.count})` : ""}
          {i < list.length - 1 ? "," : ""}
        </Link>
      ))}
    </span>
  );

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <Link href="/games" className="text-purple-600 underline">
        {t("backToGames")}
      </Link>
      <div
        className={cn(
          "border rounded-lg relative overflow-hidden p-4 space-y-1",
          game.background_image ? "text-white" : "bg-muted"
        )}
      >
        {game.background_image && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center blur-sm opacity-50"
              style={{
                backgroundImage: `url(${proxiedImage(game.background_image)})`,
              }}
            />
            <div className="absolute inset-0 bg-black/80 z-0" />
          </>
        )}
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl font-semibold">
            {game.name}
            {game.rating !== null && (
              <span className="font-mono ml-2">{game.rating}/10</span>
            )}
          </h1>
          <p>
            {t("status")}: {statusLabels[game.status] ?? game.status}
          </p>
          {game.selection_method && (
            <p>
              {t("selection")}: {methodLabels[game.selection_method] ?? game.selection_method}
            </p>
          )}
          {game.released_year && <p>{t("released")}: {game.released_year}</p>}
          {game.genres?.length ? <p>{t("genres")}: {game.genres.join(", ")}</p> : null}
          <p>{t("votes")}: {game.votes}</p>
          <p>{t("roulettes")}: {game.roulettes}</p>
          {game.initiators.length > 0 && (
            <p>
              {t("initiators")} {renderUsers(
                game.initiators,
                game.background_image ? "text-white" : "text-purple-600"
              )}
            </p>
          )}
        </div>
      </div>
      {polls.length === 0 ? (
        <p>{t("noRoulettesYet")}</p>
      ) : (
        <ul className="space-y-2">
          {polls.map((p) => (
            <li
              key={p.id}
              className={cn(
                "border p-2 rounded-lg space-y-1 relative overflow-hidden",
                p.archived && p.winnerBackground ? "bg-muted" : "bg-gray-700",
                !p.archived && "border-2 border-purple-600"
              )}
            >
              {p.archived && p.winnerBackground && (
                <>
                  <div className="absolute inset-0 bg-black/80 z-0" />
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
                    style={{
                      backgroundImage: `url(${proxiedImage(
                        p.winnerBackground
                      )})`,
                    }}
                  />
                </>
              )}
              <div className="relative z-10 text-white space-y-1">
                <h2 className="font-semibold">
                  <Link
                    href={`/archive/${p.id}`}
                    className={cn(
                      "underline",
                      p.archived && p.winnerBackground
                        ? "text-white"
                        : "text-purple-600"
                    )}
                  >
                    {t("rouletteFrom", { date: new Date(p.created_at).toLocaleString() })}
                  </Link>
                </h2>
                {p.winnerName && p.winnerId && (
                  <Link
                    href={`/games/${p.winnerId}`}
                    className={cn(
                      "text-sm underline",
                      p.archived && p.winnerBackground
                        ? "text-white"
                        : "text-purple-600"
                    )}
                  >
                    {t("winnerIs", { name: p.winnerName })}
                  </Link>
                )}
                <div className="pl-4 overflow-x-auto">
                  {p.voters.map((v) => (
                    <div key={v.id} className="text-sm whitespace-nowrap">
                      {v.count}{" "}
                      <Link
                        href={`/users/${v.id}`}
                        className={cn(
                          "underline",
                          p.archived && p.winnerBackground
                            ? "text-white"
                            : "text-purple-600"
                        )}
                      >
                        {v.username}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
              {!p.archived && (
                <span className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-purple-600 text-white rounded">
                  {t("active")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
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
    </main>
  );
}
