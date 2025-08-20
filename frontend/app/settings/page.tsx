"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import ObsMediaFields from "@/components/ObsMediaFields";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;

interface Reward {
  id: string;
  title: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [checkedMod, setCheckedMod] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [obsMedia, setObsMedia] = useState<Record<string, { gif: string; sound: string }>>({});
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState(false);

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
      setCheckedMod(false);
      if (!session) return;
      const { data } = await supabase
        .from("users")
        .select("is_moderator")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      setIsModerator(!!data?.is_moderator);
      setCheckedMod(true);
    };
    checkMod();
  }, [session]);

  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl || !session) {
        setLoading(false);
        return;
      }
      if (!checkedMod) return;
      if (!isModerator) {
        setLoading(false);
        return;
      }
      const resp = await fetch(`${backendUrl}/api/log_reward_ids`);
      if (resp.ok) {
        const data = await resp.json();
        setSelected((data.ids || []) as string[]);
      }
      const mediaResp = await fetch(`${backendUrl}/api/obs-media`);
      if (mediaResp.ok) {
        const { media } = await mediaResp.json();
        const mapped: Record<string, { gif: string; sound: string }> = {};
        for (const m of media || []) {
          mapped[m.type] = {
            gif: m.gif_url || "",
            sound: m.sound_url || "",
          };
        }
        setObsMedia(mapped);
      }
      if (channelId) {
        try {
          const tResp = await fetch(`${backendUrl}/api/streamer-token`);
          if (tResp.ok) {
            const { token: streamerToken } = await tResp.json();
            if (streamerToken) {
              const r = await fetch(
                `${backendUrl}/api/get-stream?endpoint=channel_points/custom_rewards&broadcaster_id=${channelId}`,
                { headers: { Authorization: `Bearer ${streamerToken}` } }
              );
              if (r.ok) {
                const d = await r.json();
                setRewards(
                  (d.data || []).map((x: any) => ({
                    id: x.id as string,
                    title: x.title as string,
                  }))
                );
              } else {
                setTokenError(true);
              }
            } else {
              setTokenError(true);
            }
          } else {
            setTokenError(true);
          }
        } catch {
          setTokenError(true);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [session, isModerator, checkedMod]);

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
    await Promise.all(
        Object.entries(obsMedia).map(([type, vals]) =>
          fetch(`${backendUrl}/api/obs-media`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              type,
              gif_url: vals.gif,
              sound_url: vals.sound,
            }),
          })
        )
      );
  };
  if (!backendUrl) return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  if (loading) return <div className="p-4">{t("loading")}</div>;
  if (tokenError)
    return (
      <div className="p-4 space-y-2">
        <p>{t("sessionExpired")}</p>
        <button
          className="px-2 py-1 bg-purple-600 text-white rounded"
          onClick={() => window.location.reload()}
        >
          {t("refresh")}
        </button>
      </div>
    );
  if (!isModerator) return <div className="p-4">{t("accessDenied")}</div>;

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">{t("settings")}</h1>
      {rewards.length === 0 ? (
        <p>{t("noRewards")}</p>
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
      <h2 className="text-xl font-semibold">{t("obsMedia")}</h2>
      <div className="space-y-4">
        {Object.entries(obsMedia).map(([type, values]) => (
          <ObsMediaFields
            key={type}
            prefix={type}
            values={values}
            onChange={(vals) => setObsMedia((prev) => ({ ...prev, [type]: vals }))}
          />
        ))}
      </div>
      <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={handleSave}>
        {t("save")}
      </button>
    </main>
  );
}
