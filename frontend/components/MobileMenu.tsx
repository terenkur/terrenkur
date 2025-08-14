"use client";

import { useEffect, useRef, useState } from "react";
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

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const lang = segments[0] ?? "ru";
  const buildHref = (path: string) => `/${lang}${path === "/" ? "" : path}`;

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        onClick={toggle}
        className="p-2 focus:outline-none"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          {open ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={close}
      />
      <div
        ref={menuRef}
        className={`absolute -left-4 top-full z-50 w-screen bg-background text-foreground flex flex-col space-y-2 p-4 transition-all duration-300 transform ${
          open
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 -translate-y-2"
        }`}
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={buildHref(l.href)}
            onClick={close}
            className={pathname === buildHref(l.href) ? activeClass : undefined}
          >
            {l.label}
          </Link>
        ))}
        <div
          onClick={close}
          className={pathname === buildHref("/settings") ? activeClass : undefined}
        >
          <SettingsLink />
        </div>
      </div>
    </div>
  );
}
