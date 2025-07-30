"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserInfo {
  id: number;
  username: string;
  auth_id: string | null;
  logged_in: boolean;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/users`).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    });
  }, []);

  if (!backendUrl) {
    return <div className="p-4">Backend URL not configured.</div>;
  }

  return (
    <main className="col-span-10 p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="flex items-center space-x-2">
            <Link href={`/users/${u.id}`} className="text-purple-600 underline">
              {u.username}
            </Link>
            {u.logged_in ? (
              <span className="text-green-600 text-sm">(logged in)</span>
            ) : (
              <span className="text-gray-500 text-sm">(never logged in)</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
