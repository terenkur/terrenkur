"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouletteWheel, { RouletteWheelHandle, WheelGame } from "@/components/RouletteWheel";
import SettingsModal from "@/components/SettingsModal";
import SpinResultModal from "@/components/SpinResultModal";
import type { Session } from "@supabase/supabase-js";
import type { Game, Poll, Voter } from "@/types";
import { proxiedImage } from "@/lib/utils";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
if (!backendUrl) {
  console.error("NEXT_PUBLIC_BACKEND_URL is not set");
}




export default function Home() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [initialSlots, setInitialSlots] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [voteLimit, setVoteLimit] = useState(1);
  const [usedVotes, setUsedVotes] = useState(0);
  const [actionHint, setActionHint] = useState("");
  const [rouletteGames, setRouletteGames] = useState<WheelGame[]>([]);
  const [winner, setWinner] = useState<WheelGame | null>(null);
  const [weightCoeff, setWeightCoeff] = useState(2);
  const [zeroWeight, setZeroWeight] = useState(40);
  const [acceptVotes, setAcceptVotes] = useState(true);
  const [allowEdit, setAllowEdit] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [eliminatedGame, setEliminatedGame] = useState<WheelGame | null>(null);
  const [postSpinGames, setPostSpinGames] = useState<WheelGame[]>([]);
  const [postSpinWinner, setPostSpinWinner] = useState<WheelGame | null>(null);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const [elimOrder, setElimOrder] = useState<number[]>([]);
  const [spinSeed, setSpinSeed] = useState<string | null>(null);
  const [officialMode, setOfficialMode] = useState(false);
  const router = useRouter();

  const showReset = spinSeed !== null || elimOrder.length > 0 || winner !== null;

  const resetWheel = async () => {
    if (!poll) return;
    const confirmReset = window.confirm('Reset the wheel?');
    if (!confirmReset) return;

    if (officialMode && isModerator && backendUrl) {
      const token = session?.access_token;
      await fetch(`${backendUrl}/api/poll/${poll.id}/result`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    }

    setRouletteGames(poll.games);
    setWinner(null);
    setElimOrder([]);
    setSpinSeed(null);
    setPostSpinGames([]);
    setPostSpinWinner(null);
    setEliminatedGame(null);
  };

  const sendResult = async (winnerId: number) => {
    if (!backendUrl || !isModerator || !poll) return null;
    const token = session?.access_token;
    return fetch(`${backendUrl}/api/poll/${poll.id}/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        winner_id: winnerId,
        eliminated_order: elimOrder,
        spin_seed: spinSeed ?? undefined,
      }),
    });
  };

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  const fetchPoll = async () => {
    setLoading(true);
    const resp = await fetch(`${backendUrl}/api/poll`);
    if (!resp.ok) {
      setLoading(false);
      return;
    }
    const pollRes = await resp.json();
    const pollData: Poll = {
      id: pollRes.poll_id,
      created_at: pollRes.created_at,
      archived: pollRes.archived,
      games: pollRes.games,
    };

    const coeffResp = await fetch(`${backendUrl}/api/voice_coeff`);
    if (coeffResp.ok) {
      const coeffData = await coeffResp.json();
      setWeightCoeff(Number(coeffData.coeff));
    }

    const zeroResp = await fetch(`${backendUrl}/api/zero_vote_weight`);
    if (zeroResp.ok) {
      const zeroData = await zeroResp.json();
      setZeroWeight(Number(zeroData.weight));
    }

    const accResp = await fetch(`${backendUrl}/api/accept_votes`);
    if (accResp.ok) {
      const accData = await accResp.json();
      setAcceptVotes(Number(accData.value) !== 0);
    }

    const editResp = await fetch(`${backendUrl}/api/allow_edit`);
    if (editResp.ok) {
      const editData = await editResp.json();
      setAllowEdit(Number(editData.value) !== 0);
    }

    const { data: votes } = await supabase
      .from("votes")
      .select("game_id, user_id, slot")
      .eq("poll_id", pollRes.poll_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, username, auth_id, vote_limit, is_moderator");

    let limit = 1;
    let used = 0;
    let myVotes: { slot: number; game_id: number }[] = [];
    setIsModerator(false);
    if (session && users) {
      const currentUser = users.find((u) => u.auth_id === session.user.id);
      if (currentUser) {
        limit = currentUser.vote_limit || 1;
        setIsModerator(!!currentUser.is_moderator);
        myVotes =
          votes?.
            filter((v) => v.user_id === currentUser.id)
            .map((v) => ({ slot: v.slot, game_id: v.game_id })) || [];
        used = myVotes.length;
      }
    }
    setVoteLimit(limit);
    setUsedVotes(used);

    const slotArr = Array(limit).fill(null) as (number | null)[];
    myVotes.forEach((v) => {
      if (v.slot - 1 >= 0 && v.slot - 1 < limit) {
        slotArr[v.slot - 1] = v.game_id;
      }
    });
    setSlots(slotArr);
    setInitialSlots(slotArr);

    setPoll(pollData);
    setRouletteGames(pollData.games);
    setElimOrder([]);
    setSpinSeed(null);
    setWinner(null);
    setLoading(false);
  };

  useEffect(() => {
    fetchPoll();
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
    if (session) {
      fetchPoll();
    }
  }, [session]);

  useEffect(() => {
    if (initialSlots.length === 0) return;
    const currentSelected = slots.filter((s) => s !== null) as number[];
    const originalSelected = initialSlots.filter((s) => s !== null) as number[];
    const added = currentSelected.length > originalSelected.length;
    const removed = currentSelected.length < originalSelected.length;
    const changed =
      !added &&
      !removed &&
      (currentSelected.length !== originalSelected.length ||
        currentSelected.some((v, i) => v !== originalSelected[i]));
    if (added) {
      setActionHint("Adding vote");
    } else if (removed) {
      setActionHint("Removing vote");
    } else if (changed) {
      setActionHint("Revoting");
    } else {
      setActionHint("");
    }
  }, [slots, initialSlots]);


  const adjustVote = (gameId: number, delta: number) => {
    if (!acceptVotes) return;
    if (!allowEdit) {
      setActionHint("Editing disabled");
      return;
    }
    setActionHint("");
    setSlots((prev) => {
      const arr = [...prev];
      if (delta > 0) {
        const free = arr.indexOf(null);
        if (free !== -1) {
          arr[free] = gameId;
        } else {
          setActionHint("Vote limit reached");
          return arr;
        }
      } else if (delta < 0) {
        const idx = arr.lastIndexOf(gameId);
        if (idx !== -1) {
          arr[idx] = null;
        }
      }
    return arr;
  });
  };

  const handleSpinEnd = (game: WheelGame) => {
    // Determine games left after removing the selected one
    const remaining = rouletteGames.filter((g) => g.id !== game.id);

    setElimOrder((prev) => [...prev, game.id]);

    // Identify winner if only one game remains (or none left)
    let win: WheelGame | null = null;
    if (remaining.length === 1) {
      win = remaining[0];
    } else if (remaining.length === 0) {
      win = game;
    }

    // Store result for modal display
    setPostSpinGames(remaining);
    setPostSpinWinner(win);
    setEliminatedGame(game);
  };

  const closeResult = async () => {
    setRouletteGames(postSpinGames);
    if (postSpinWinner) {
      setWinner(postSpinWinner);
      if (officialMode && backendUrl && poll) {
        try {
          const resp = await sendResult(postSpinWinner.id);
          if (!resp || !resp.ok) {
            console.error("Failed to record result");
            setEliminatedGame(null);
            return;
          }
          const token = session?.access_token;
          const arch = await fetch(`${backendUrl}/api/polls/${poll.id}/archive`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (arch.ok) {
            router.push(`/new-poll?copy=${poll.id}`);
          } else {
            console.error("Failed to archive poll");
          }
        } catch (err) {
          console.error("Error closing result", err);
        }
      }
    } else {
      setWinner(null);
    }
    setEliminatedGame(null);
  };

  const handleSpin = () => {
    if (!spinSeed) {
      setSpinSeed(Date.now().toString());
    }
    wheelRef.current?.spin();
  };

  const handleVote = async () => {
    if (!poll) return;
    if (!acceptVotes) return;
    if (!allowEdit) return;
    const selected = slots.filter((id) => id !== null) as number[];
    if (selected.length === 0) return;
    if (!backendUrl) {
      alert("Backend URL not configured");
      return;
    }
    setSubmitting(true);
    const token = session?.access_token;

    const username =
      session?.user.user_metadata.preferred_username ||
      session?.user.user_metadata.name ||
      session?.user.user_metadata.full_name ||
      session?.user.user_metadata.nickname ||
      session?.user.email;

    // send one request per vote slot
    for (let i = 0; i < voteLimit; i++) {
      const gameId = slots[i];
      await fetch(`${backendUrl}/api/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          poll_id: poll.id,
          game_id: gameId ?? null,
          slot: i + 1,
          username,
        }),
      });
    }
    setSlots(Array(voteLimit).fill(null));
    await fetchPoll();
    setSubmitting(false);
  };

  const saveCoeff = async (value: number) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/voice_coeff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ coeff: value }),
    });
  };

  const saveZeroWeight = async (value: number) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/zero_vote_weight`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ weight: value }),
    });
  };

  const saveAccept = async (value: boolean) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/accept_votes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ value }),
    });
  };

  const saveAllowEdit = async (value: boolean) => {
    if (!backendUrl) return;
    const token = session?.access_token;
    await fetch(`${backendUrl}/api/allow_edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ value }),
    });
  };

  const startOfficialSpin = async () => {
    const confirmStart = window.confirm("Start official spin?");
    if (!confirmStart) return;
    await saveAccept(false);
    await saveAllowEdit(false);
    setAcceptVotes(false);
    setAllowEdit(false);
    setOfficialMode(true);
  };


  if (loading) return <div className="p-4">Loading...</div>;
  if (!poll) return <div className="p-4">No poll available.</div>;

  return (
    <>
      <main className="col-span-10 grid grid-cols-8 gap-x-2 gap-y-4 max-w-5xl">
        <div className="col-span-3 px-2 py-4 space-y-4 overflow-y-auto">
        <h1 className="text-2xl font-semibold">Current Poll</h1>
        {isModerator && (
          <div className="space-x-2">
            <button
              className="px-2 py-1 bg-purple-600 text-white rounded"
              onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
          {!officialMode ? (
            <button
              className="px-2 py-1 bg-red-600 text-white rounded"
              onClick={startOfficialSpin}
            >
              Start official spin
            </button>
          ) : (
          <span className="px-2 py-1 bg-green-600 text-white rounded">
            Official spin
          </span>
        )}
      </div>
      )}
      <p>You can cast up to {voteLimit} votes.</p>
      {!acceptVotes && (
        <p className="text-red-500">Voting is currently closed.</p>
      )}
      <ul className="space-y-2">
        {poll.games.map((game) => {
          const count = slots.filter((s) => s === game.id).length;
          const totalSelected = slots.filter((s) => s !== null).length;
          return (
            <li
              key={game.id}
              className="border p-2 rounded-lg bg-muted space-y-1 relative overflow-hidden"
            >
              {game.background_image && (
                <div
                  className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 -z-10"
                  style={{ backgroundImage: `url(${proxiedImage(game.background_image)})` }}
                />
              )}
              <div className="flex items-center space-x-2">
                <button
                  className="px-2 py-1 bg-gray-300 rounded disabled:opacity-50"
                  onClick={() => adjustVote(game.id, -1)}
                  disabled={count === 0 || !acceptVotes || !allowEdit}
                >
                  -
                </button>
                <span>{count}</span>
                <button
                  className="px-2 py-1 bg-gray-300 rounded disabled:opacity-50"
                  onClick={() => adjustVote(game.id, 1)}
                  disabled={totalSelected >= voteLimit || !acceptVotes || !allowEdit}
                >
                  +
                </button>
                <span>{game.name}</span>
                <span className="font-mono">{game.count}</span>
              </div>
              <ul className="pl-4 list-disc">
                {game.nicknames.map((voter) => (
                  <li key={voter.id}>
                    {voter.count}{" "}
                    <Link
                      href={`/users/${voter.id}`}
                      className="text-purple-600 underline"
                    >
                      {voter.username}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <button
        className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
        disabled={!slots.some((s) => s !== null) || submitting || !session || !acceptVotes || !allowEdit}
        onClick={handleVote}
      >
        {submitting ? "Voting..." : "Vote"}
      </button>
      {actionHint && (
        <p className="text-sm text-gray-500">{actionHint}</p>
      )}
      <p className="text-sm text-gray-500">
        You have used {usedVotes} of {voteLimit} votes.
      </p>
        </div>
        <div className="col-span-5 px-2 py-4 flex flex-col items-center justify-center">
        {rouletteGames.length > 0 && !winner && (
          <>
            <RouletteWheel
              ref={wheelRef}
              games={rouletteGames}
              onDone={handleSpinEnd}
              weightCoeff={weightCoeff}
              zeroWeight={zeroWeight}
              spinSeed={spinSeed ?? undefined}
            />
            <div className="flex gap-2 mt-2">
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded"
                onClick={handleSpin}
              >
                Spin
              </button>
              {showReset && (
                <button
                  className="px-4 py-2 bg-gray-300 rounded"
                  onClick={resetWheel}
                >
                  Reset
                </button>
              )}
            </div>
          </>
        )}
        {winner && (
          <h2 className="text-2xl font-bold">Winning game: {winner.name}</h2>
        )}
        </div>
      </main>


      {showSettings && (
        <SettingsModal
          coeff={weightCoeff}
          zeroWeight={zeroWeight}
          acceptVotes={acceptVotes}
        allowEdit={allowEdit}
        onClose={() => setShowSettings(false)}
        onSave={async (c, z, acc, edit) => {
          await saveCoeff(c);
          await saveZeroWeight(z);
          await saveAccept(acc);
          await saveAllowEdit(edit);
          setWeightCoeff(c);
          setZeroWeight(z);
          setAcceptVotes(acc);
          setAllowEdit(edit);
          setShowSettings(false);
        }}
      />
      )}
      {eliminatedGame && (
        <SpinResultModal
          eliminated={eliminatedGame}
          winner={postSpinWinner}
          onClose={closeResult}
        />
      )}
    </>
  );
}
