'use client';
import { supabase } from '@/utils/supabaseClient';
import { useEffect, useState } from 'react';

interface Game {
  id: number;
  name: string;
  count: number;
  usernames: string[];
}

interface Poll {
  id: number;
  games: Game[];
}

export default function PollPage() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPoll = async () => {
    setLoading(true);
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError || !pollData) {
      setLoading(false);
      return;
    }

    const { data: games } = await supabase.from('games').select('id, name');
    const { data: votes } = await supabase
      .from('votes')
      .select('game_id, user_id')
      .eq('poll_id', pollData.id);
    const { data: users } = await supabase
      .from('users')
      .select('id, username');

    const userMap =
      users?.reduce((acc: Record<number, string>, u) => {
        acc[u.id] = u.username;
        return acc;
      }, {}) || {};

    const counts: Record<number, number> = {};
    const usernames: Record<number, string[]> = {};

    votes?.forEach((v) => {
      counts[v.game_id] = (counts[v.game_id] || 0) + 1;
      if (!usernames[v.game_id]) usernames[v.game_id] = [];
      const name = userMap[v.user_id];
      if (name) usernames[v.game_id].push(name);
    });

    const results =
      games?.map((g) => ({
        id: g.id,
        name: g.name,
        count: counts[g.id] || 0,
        usernames: usernames[g.id] || [],
      })) || [];

    setPoll({ id: pollData.id, games: results });
    setLoading(false);
  };

  useEffect(() => {
    fetchPoll();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!poll) return <div className="p-4">No poll available.</div>;

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Current Poll</h1>
      <ul className="space-y-2">
        {poll.games.map((game) => (
          <li
            key={game.id}
            className="border p-2 rounded space-y-1"
          >
            <span>{game.name}</span>
            <span className="font-mono">{game.count}</span>
            <ul className="pl-4 list-disc">
              {game.usernames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
