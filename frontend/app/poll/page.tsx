'use client';
import { supabase } from '@/utils/supabaseClient';
import { useEffect, useState } from 'react';

interface Game {
  id: number;
  name: string;
  count: number;
}

interface Poll {
  id: number;
  games: Game[];
}

export default function PollPage() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      .select('game_id')
      .eq('poll_id', pollData.id);

    const counts =
      votes?.reduce((acc: Record<number, number>, v) => {
        acc[v.game_id] = (acc[v.game_id] || 0) + 1;
        return acc;
      }, {}) || {};

    const results =
      games?.map((g) => ({
        id: g.id,
        name: g.name,
        count: counts[g.id] || 0,
      })) || [];

    setPoll({ id: pollData.id, games: results });
    setLoading(false);
  };

  useEffect(() => {
    fetchPoll();
  }, []);

  const handleVote = async (gameId: number) => {
    if (!nickname.trim()) {
      alert('Please enter a nickname');
      return;
    }

    setSubmitting(true);
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poll_id: poll?.id, game_id: gameId, nickname }),
    });
    setSubmitting(false);
    fetchPoll();
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!poll) return <div className="p-4">No poll available.</div>;

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Current Poll</h1>
      <input
        className="border rounded px-2 py-1 w-full"
        placeholder="Your nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <ul className="space-y-2">
        {poll.games.map((game) => (
          <li
            key={game.id}
            className="flex justify-between items-center border p-2 rounded"
          >
            <span>{game.name}</span>
            <span className="font-mono">{game.count}</span>
            <button
              className="ml-4 bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
              onClick={() => handleVote(game.id)}
              disabled={submitting}
            >
              Vote
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
