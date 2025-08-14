"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SettingsLink from "@/components/SettingsLink";
import { useTranslation } from "react-i18next";

const activeClass = "text-primary font-bold";

export default function MainNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const links = [
    { href: "/", label: "Home" },
    { href: "/archive", label: "Archive" },
    { href: "/games", label: "Games" },
    { href: "/users", label: t("users") },
    { href: "/stats", label: "Stats" },
    { href: "/playlists", label: "Playlists" },
  ];

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
