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
  const segments = pathname.split("/").filter(Boolean);
  const lang = segments[0] ?? "ru";
  const buildHref = (path: string) => `/${lang}${path === "/" ? "" : path}`;

  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={buildHref(l.href)}
          className={pathname === buildHref(l.href) ? activeClass : undefined}
        >
          {l.label}
        </Link>
      ))}
      <div className={pathname === buildHref("/settings") ? activeClass : undefined}>
        <SettingsLink />
      </div>
    </>
  );
}
