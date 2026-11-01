"use client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";


interface UserInfo {
  id: number;
  username: string;
  twitch_login: string | null;
}

function UserRow({ user }: { user: UserInfo }) {
  const login = user.twitch_login;
  return (
    <li>
      <Link href={`/users/${user.id}`} className="group block rounded-lg border bg-background px-3 py-2 hover:border-purple-500 focus-visible:outline-purple-500">
        <span className="block break-all font-semibold group-hover:underline">{user.username}</span>
        {login && login.toLowerCase() !== user.username.toLowerCase() && (
          <span className="block break-all text-sm text-muted-foreground">@{login}</span>
        )}
      </Link>
    </li>
  );
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersReload, setUsersReload] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    if (!backendUrl) return;
    const params = new URLSearchParams({ votersOnly: 'true' });
    if (query.trim()) params.set('search', query.trim());
    const url = `${backendUrl}/api/users?${params}`;
    const controller = new AbortController();
    setLoading(true);
    setUsersError(null);
    fetchWithTimeout(url, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!controller.signal.aborted) setUsers(data.users || []);
    }).catch(() => {
      if (!controller.signal.aborted) setUsersError('Не удалось загрузить пользователей. Попробуйте ещё раз.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [query, usersReload]);

  if (!backendUrl) {
    return <div className="p-4">{t("backendUrlNotConfigured")}</div>;
  }

  return (
    <section className="min-w-0 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{t("users")}</h1>
        <p className="text-sm text-muted-foreground">Зрители, голосовавшие в рулетках.</p>
      </header>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Поиск по нику"
        placeholder="Поиск по нику"
        className="w-full rounded border bg-background p-2 text-foreground"
      />
      <p role="status" className="text-sm text-muted-foreground">
        {users !== null && <>Участников в списке: {users.length}</>}
        {loading && (users === null ? t("loading") : " · Обновляем…")}
      </p>
      {usersError && (
        <div role="alert" className="space-y-2 rounded-lg border p-3">
          <p>{usersError}</p>
          <button onClick={() => setUsersReload(v => v + 1)} className="rounded border px-3 py-1">{t("retry")}</button>
        </div>
      )}
      {!loading && !usersError && users?.length === 0 && (
        <div className="space-y-2 rounded-lg border p-3">
          <p>{query.trim() ? "Никого не нашли." : "Пока никто не голосовал."}</p>
          {query.trim() && <button onClick={() => setQuery("")} className="underline">Очистить поиск</button>}
        </div>
      )}
      <ul aria-busy={loading} className="space-y-2">
        {users?.map(user => <UserRow key={user.id} user={user} />)}
      </ul>
    </section>
  );
}
