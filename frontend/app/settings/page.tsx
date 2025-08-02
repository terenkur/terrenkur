"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  getStoredProviderToken,
  refreshProviderToken,
  storeProviderToken,
} from "@/lib/twitch";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;

interface Reward {
  id: string;
  title: string;
}

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
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

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl || !session) {
        setLoading(false);
        return;
      }
      const resp = await fetch(`${backendUrl}/api/log_reward_ids`);
      if (resp.ok) {
        const data = await resp.json();
        setSelected((data.ids || []) as string[]);
      }
      const token =
        ((session as any)?.provider_token as string | undefined) ||
        getStoredProviderToken();
      if (token && channelId) {
        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
          };
          let r = await fetch(
            `${backendUrl}/api/get-stream?endpoint=channel_points/custom_rewards&broadcaster_id=${channelId}`,
            { headers }
          );
          if (r.status === 401) {
            const { token: newToken, error } = await refreshProviderToken();
            if (error || !newToken) {
              await supabase.auth.signOut();
              storeProviderToken(undefined);
              if (typeof window !== 'undefined') {
                alert('Session expired. Please authorize again.');
              }
              throw new Error('unauthorized');
            }
            headers.Authorization = `Bearer ${newToken}`;
            r = await fetch(
              `${backendUrl}/api/get-stream?endpoint=channel_points/custom_rewards&broadcaster_id=${channelId}`,
              { headers }
            );
          }
          if (r.ok) {
            const d = await r.json();
            setRewards(
              (d.data || []).map((x: any) => ({ id: x.id as string, title: x.title as string }))
            );
          }
        } catch {
          // ignore
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [session]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!backendUrl || !session) return;
    const token = session.access_token;
    await fetch(`${backendUrl}/api/log_reward_ids`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids: selected }),
    });
  };

  if (!backendUrl) return <div className="p-4">Backend URL not configured.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!isModerator) return <div className="p-4">Access denied.</div>;

  return (
    <main className="col-span-9 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {rewards.length === 0 ? (
        <p>No rewards found.</p>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => (
            <li key={r.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={() => toggle(r.id)}
              />
              <span>{r.title}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={handleSave}>
        Save
      </button>
    </main>
  );
}
