"use client";

import Link from "next/link";

export interface StatUser {
  id: number;
  username: string;
  value: number;
}

interface Props {
  title: string;
  rows: StatUser[];
}

export default function StatsTable({ title, rows }: Props) {
  return (
    <details className="space-y-2">
      <summary className="cursor-pointer text-xl font-semibold">
        {title}
      </summary>
      {rows.length === 0 ? (
        <p>No data.</p>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">User</th>
                  <th className="p-2 text-right">{title}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">
                      <Link
                        href={`/users/${u.id}`}
                        className="text-purple-600 underline"
                      >
                        {u.username}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{u.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </details>
  );
}

