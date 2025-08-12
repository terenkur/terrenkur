"use client";

import Link from "next/link";
import MedalIcon, { MedalType } from "@/components/MedalIcon";

export interface StatUser {
  id: number;
  username: string;
  value: number;
  medal?: MedalType | null;
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
                {rows.map((u, idx) => {
                  const medal: MedalType | undefined =
                    u.medal ??
                    (idx === 0
                      ? "gold"
                      : idx === 1
                      ? "silver"
                      : idx === 2
                      ? "bronze"
                      : undefined);
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <MedalIcon type={medal} />
                          <Link
                            href={`/users/${u.id}`}
                            className="text-purple-600 underline"
                          >
                            {u.username}
                          </Link>
                        </div>
                      </td>
                      <td className="p-2 text-right">{u.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </details>
  );
}

