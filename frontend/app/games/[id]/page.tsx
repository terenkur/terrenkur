"use client";

import { use, useEffect, useState } from "react";
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
  const [game, setGame] = useState<GameInfo | null>(null);
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);

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
    return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!game) return <div className="p-4">Game not found.</div>;

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
    <main className="col-span-9 p-4 space-y-4">
      <Link href="/games" className="text-purple-600 underline">
        Back to games
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
          <p>Status: {game.status}</p>
          {game.selection_method && <p>Selection: {game.selection_method}</p>}
          {game.released_year && <p>Released: {game.released_year}</p>}
          {game.genres?.length ? <p>Genres: {game.genres.join(", ")}</p> : null}
          <p>Votes: {game.votes}</p>
          <p>Roulettes: {game.roulettes}</p>
          {game.initiators.length > 0 && (
            <p>
              Initiators:{" "}
              {renderUsers(
                game.initiators,
                game.background_image ? "text-white" : "text-purple-600"
              )}
            </p>
          )}
        </div>
      </div>
      {polls.length === 0 ? (
        <p>No roulettes yet.</p>
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
                    Roulette from {new Date(p.created_at).toLocaleString()}
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
                    Winner is {p.winnerName}
                  </Link>
                )}
                <div className="pl-4">
                  {p.voters.map((v) => (
                    <div key={v.id} className="text-sm">
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
                  Active
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
