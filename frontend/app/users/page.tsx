"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_ICONS } from "@/lib/roleIcons";
import { useTwitchUserInfo } from "@/lib/useTwitchUserInfo";

const enableTwitchRoles =
  process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

interface UserInfo {
  id: number;
  username: string;
  auth_id: string | null;
  twitch_login: string | null;
  logged_in: boolean;
}

function UserRowBase({
  user,
  roles,
}: {
  user: UserInfo;
  roles: string[];
}) {
  return (
    <li className="flex items-center space-x-2 border p-2 rounded-lg bg-muted">
      <span className="flex items-center space-x-1">
        {roles.map((r) =>
          ROLE_ICONS[r] ? (
            <img key={r} src={ROLE_ICONS[r]} alt={r} className="w-4 h-4" />
          ) : null
        )}
        <Link href={`/users/${user.id}`} className="text-purple-600 underline">
          {user.username}
        </Link>
      </span>
      {user.logged_in ? (
        <span className="text-green-600 text-sm">(logged in)</span>
      ) : (
        <span className="text-gray-500 text-sm">(never logged in)</span>
      )}
    </li>
  );
}

function UserRow({ user }: { user: UserInfo }) {
  const { roles } = useTwitchUserInfo(user.twitch_login);
  return <UserRowBase user={user} roles={roles} />;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!backendUrl) return;
    const url = query.trim()
      ? `${backendUrl}/api/users?search=${encodeURIComponent(query.trim())}`
      : `${backendUrl}/api/users`;
    fetch(url).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    });
  }, [query]);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  return (
    <main className="col-span-9 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className="border p-1 rounded w-full text-black"
      />
      <ul className="space-y-2">
        {users.map((u) =>
          enableTwitchRoles ? (
            <UserRow key={u.id} user={u} />
          ) : (
            <UserRowBase key={u.id} user={u} roles={[]} />
          )
        )}
      </ul>
    </main>
  );
}
