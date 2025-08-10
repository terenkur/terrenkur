"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_ICONS } from "@/lib/roleIcons";
import { useTwitchUserInfo } from "@/lib/useTwitchUserInfo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const enableTwitchRoles =
  process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";

interface UserInfo {
  id: number;
  username: string;
  auth_id: string | null;
  twitch_login: string | null;
  total_streams_watched: number;
  total_subs_gifted: number;
  total_subs_received: number;
  total_chat_messages_sent: number;
  total_times_tagged: number;
  total_commands_run: number;
  total_months_subbed: number;
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
    <li className="flex items-center space-x-2 border p-2 rounded-lg bg-muted text-sm whitespace-nowrap">
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

function UserRow({
  user,
  requiredRoles,
}: {
  user: UserInfo;
  requiredRoles: string[];
}) {
  const { roles } = useTwitchUserInfo(user.twitch_login);
  if (!requiredRoles.every((r) => roles.includes(r))) return null;
  return <UserRowBase user={user} roles={roles} />;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [query, setQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

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
    <main className="col-span-12 md:col-span-9 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className="border p-1 rounded w-full text-black"
      />
      <DropdownMenu>
        <DropdownMenuTrigger className="border p-1 rounded">
          Filter Roles
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {["Streamer", "VIP", "Mod", "Sub"].map((role) => (
            <DropdownMenuItem
              key={role}
              onSelect={(e) => {
                e.preventDefault();
                setSelectedRoles((prev) =>
                  prev.includes(role)
                    ? prev.filter((r) => r !== role)
                    : [...prev, role]
                );
              }}
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                readOnly
                className="mr-2"
              />
              {role}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="overflow-x-auto">
        <ul className="space-y-2">
          {users.map((u) =>
            enableTwitchRoles ? (
              <UserRow
                key={u.id}
                user={u}
                requiredRoles={selectedRoles}
              />
            ) : (
              <UserRowBase key={u.id} user={u} roles={[]} />
            )
          )}
        </ul>
      </div>
    </main>
  );
}
