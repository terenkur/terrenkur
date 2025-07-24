"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserInfo {
  id: number;
  username: string;
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
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/users/${u.id}`} className="text-purple-600 underline">
              {u.username}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
