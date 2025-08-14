"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SettingsLink from "@/components/SettingsLink";

const links = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
  { href: "/games", label: "Games" },
  { href: "/users", label: "Users" },
  { href: "/stats", label: "Stats" },
  { href: "/playlists", label: "Playlists" },
];

const activeClass = "text-primary font-bold";

export default function MainNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname === l.href ? activeClass : undefined}
        >
          {l.label}
        </Link>
      ))}
      <div className={pathname === "/settings" ? activeClass : undefined}>
        <SettingsLink />
      </div>
    </>
  );
}
