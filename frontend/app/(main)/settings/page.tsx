"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import ObsMediaList from "@/components/ObsMediaList";
import { useSettings } from "@/components/SettingsProvider";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const channelId = process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID;

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [checkedMod, setCheckedMod] = useState(false);
  const {
    rewards,
    setRewards,
    selected,
    setSelected,
    obsMedia,
    setObsMedia,
    obsTypes,
    setObsTypes,
    removedMedia,
    setRemovedMedia,
  } = useSettings();
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
  const { data: idsData, isLoading: idsLoading } = useSWR(
    backendUrl && session && checkedMod && isModerator
      ? `${backendUrl}/api/log_reward_ids`
      : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  useEffect(() => {
    if (idsData?.ids) setSelected(idsData.ids as string[]);
  }, [idsData, setSelected]);

  const { data: mediaData, isLoading: mediaLoading } = useSWR(
    backendUrl && session && checkedMod && isModerator
      ? `${backendUrl}/api/obs-media?grouped=true`
      : null,
    (url: string) =>
      fetch(url, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      }).then((r) => r.json())
  );

  useEffect(() => {
    if (mediaData) {
      const { media } = mediaData;
      const types = Array.isArray(mediaData.types)
        ? mediaData.types
        : Object.keys(media || {});
      const grouped = types.reduce(
        (acc: Record<string, { id?: number; gif: string; sound: string }[]>, t: string) => {
          const items = Array.isArray(media?.[t]) ? media[t] : [];
          acc[t] = items.map((m: any) => ({
            id: m.id,
            gif: m.gif_url || m.gif || "",
            sound: m.sound_url || m.sound || "",
          }));
          return acc;
        },
        {}
      );
      setObsMedia(grouped);
      setObsTypes(types);
    }
  }, [mediaData, setObsMedia, setObsTypes]);

  const {
    data: rewardsData,
    isLoading: rewardsLoading,
    error: rewardsError,
  } = useSWR(
    backendUrl && channelId && session && checkedMod && isModerator
      ? `rewards-${channelId}`
      : null,
    async () => {
      const tResp = await fetch(`${backendUrl}/api/streamer-token`);
      if (!tResp.ok) throw new Error("token");
      const { token: streamerToken } = await tResp.json();
      if (!streamerToken) throw new Error("token");
      const r = await fetch(
        `${backendUrl}/api/get-stream?endpoint=channel_points/custom_rewards&broadcaster_id=${channelId}`,
        { headers: { Authorization: `Bearer ${streamerToken}` } }
      );
      if (!r.ok) throw new Error("token");
      const d = await r.json();
      return (d.data || []).map((x: any) => ({
        id: x.id as string,
        title: x.title as string,
      }));
    }
  );

  useEffect(() => {
    if (rewardsData) setRewards(rewardsData);
  }, [rewardsData, setRewards]);

  useEffect(() => {
    if (rewardsError) setTokenError(true);
  }, [rewardsError]);

  const loading =
    !checkedMod || idsLoading || mediaLoading || rewardsLoading;

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
      removedMedia.map((id) =>
        fetch(`${backendUrl}/api/obs-media/${id}`, {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
      )
    );
    await Promise.all(
      Object.entries(obsMedia).flatMap(([key, items]) =>
        items.map((item) => {
          const body = {
            type: key,
            gif_url: item.gif,
            sound_url: item.sound,
          };
          const url = `${backendUrl}/api/obs-media${item.id ? `/${item.id}` : ""}`;
          return fetch(url, {
            method: item.id ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          });
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
        <div className="space-x-2">
          <button
            className="px-2 py-1 bg-purple-600 text-white rounded"
            onClick={() => router.refresh()}
          >
            {t("refresh")}
          </button>
          <button
            className="px-2 py-1 bg-purple-600 text-white rounded"
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              })
            }
          >
            {t("loginWithTwitch")}
          </button>
        </div>
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
        {obsTypes.map((type) => (
          <ObsMediaList
            key={type}
            type={type}
            items={obsMedia[type] || []}
            onChange={(items) =>
              setObsMedia((prev) => ({ ...prev, [type]: items }))
            }
            onRemove={(id) =>
              setRemovedMedia((prev) => (id ? [...prev, id] : prev))
            }
          />
        ))}
      </div>
      <button className="px-2 py-1 bg-purple-600 text-white rounded" onClick={handleSave}>
        {t("save")}
      </button>
    </main>
  );
}
