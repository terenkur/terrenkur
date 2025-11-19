"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ROLE_ICONS, getSubBadge } from "@/lib/roleIcons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

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
  clips_created: number;
  combo_commands: number;
  logged_in: boolean;
}

function UserRowBase({
  user,
  roles,
}: {
  user: UserInfo;
  roles: string[];
}) {
  const { t } = useTranslation();
  const badge = getSubBadge(user.total_months_subbed);
  return (
    <li className="flex items-center space-x-2 border p-2 rounded-lg bg-muted text-sm whitespace-nowrap">
      <span className="flex items-center space-x-1">
        {roles.map((r) =>
          r === "Sub"
            ? badge
              ? (
                  <Image
                    key={r}
                    src={badge}
                    alt={r}
                    width={16}
                    height={16}
                    className="w-4 h-4"
                    loading="lazy"
                  />
                )
              : null
            : ROLE_ICONS[r]
            ? (
                <Image
                  key={r}
                  src={ROLE_ICONS[r]}
                  alt={r}
                  width={16}
                  height={16}
                  className="w-4 h-4"
                  loading="lazy"
                />
              )
            : null
        )}
        <Link href={`/users/${user.id}`} className="text-purple-600 underline">
          {user.username}
        </Link>
      </span>
      {user.logged_in ? (
        <span className="text-green-600 text-sm">({t("loggedIn")})</span>
      ) : (
        <span className="text-gray-500 text-sm">({t("neverLoggedIn")})</span>
      )}
    </li>
  );
}

type RoleCache = Record<string, string[]>;

function UserRow({
  user,
  requiredRoles,
  roleCache,
}: {
  user: UserInfo;
  requiredRoles: string[];
  roleCache: RoleCache;
}) {
  const login = user.twitch_login?.toLowerCase() || null;
  const roles = (login ? roleCache[login] : null) || [];
  if (!requiredRoles.every((r) => roles.includes(r))) return null;
  return <UserRowBase user={user} roles={roles} />;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [query, setQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleCache, setRoleCache] = useState<RoleCache>({});
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesReloadToken, setRolesReloadToken] = useState(0);
  const { t } = useTranslation();

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

  useEffect(() => {
    if (!enableTwitchRoles || !backendUrl) return;
    const logins = Array.from(
      new Set(
        users
          .map((u) => u.twitch_login?.toLowerCase())
          .filter((login): login is string => Boolean(login))
      )
    );
    if (logins.length === 0) {
      setRoleCache({});
      setRolesError(null);
      setRolesLoading(false);
      return;
    }
    let canceled = false;
    setRolesLoading(true);
    setRolesError(null);
    const params = new URLSearchParams();
    logins.forEach((login) => params.append("logins", login));
    fetch(`${backendUrl}/api/twitch-roles?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (canceled) return;
        if (!res.ok) {
          setRolesError((data as { error?: string }).error || t("twitchInfoFetchFailed"));
          setRoleCache({});
          return;
        }
        const responseRoles = (data as { roles?: Record<string, { roles?: string[] }> }).roles || {};
        const nextCache: RoleCache = {};
        logins.forEach((login) => {
          nextCache[login] = responseRoles[login]?.roles || [];
        });
        setRoleCache(nextCache);
      })
      .catch((err: unknown) => {
        if (canceled) return;
        const message = err instanceof Error ? err.message : t("twitchInfoFetchFailed");
        setRolesError(message);
        setRoleCache({});
      })
      .finally(() => {
        if (!canceled) {
          setRolesLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [users, backendUrl, rolesReloadToken, enableTwitchRoles]);

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
      <DropdownMenu>
        <DropdownMenuTrigger className="border p-1 rounded">
          {t("filterRoles")}
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
              {t(`roles.${role}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {enableTwitchRoles && rolesError && (
        <div className="text-sm text-red-600 flex items-center justify-between gap-2 border border-red-200 rounded p-2">
          <span>{rolesError}</span>
          <button
            type="button"
            className="underline"
            onClick={() => setRolesReloadToken((token) => token + 1)}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {enableTwitchRoles && rolesLoading && (
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      )}
      <div className="overflow-x-auto">
        <ul className="space-y-2">
          {users.map((u) =>
            enableTwitchRoles ? (
              <UserRow
                key={u.id}
                user={u}
                requiredRoles={selectedRoles}
                roleCache={roleCache}
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
