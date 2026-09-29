"use client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";


interface UserInfo {
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
}

function UserRow({ user }: { user: UserInfo }) {
  return <li className="border p-2 rounded-lg bg-muted text-sm">
    <Link href={`/users/${user.id}`} className="text-purple-600 underline">{user.username}</Link>
  </li>;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [query, setQuery] = useState("");
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersReload, setUsersReload] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    if (!backendUrl) return;
    const url = query.trim()
      ? `${backendUrl}/api/users?search=${encodeURIComponent(query.trim())}`
      : `${backendUrl}/api/users`;
    const controller = new AbortController();
    setUsersError(null);
    fetchWithTimeout(url, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!controller.signal.aborted) setUsers(data.users || []);
    }).catch(() => {
      if (!controller.signal.aborted) setUsersError('Не удалось загрузить пользователей. Попробуйте ещё раз.');
    });
    return () => controller.abort();
  }, [query, usersReload]);

  if (!backendUrl) {
    return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  }

  return (
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">{t("users")}</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        className="border p-1 rounded w-full text-black"
      />
      {usersError && <div role="alert" className="space-y-2"><p>{usersError}</p><button onClick={() => setUsersReload(v => v + 1)}>Повторить</button></div>}
      <div className="overflow-x-auto">
        <ul className="space-y-2">
          {users.map((u) => <UserRow key={u.id} user={u} />)}
        </ul>
      </div>
    </main>
  );
}
