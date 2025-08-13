"use client";

import { useState } from "react";
import Link from "next/link";
import SettingsLink from "@/components/SettingsLink";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

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
      {open && (
        <div className="absolute left-0 top-full z-50 w-full bg-muted text-foreground flex flex-col space-y-2 p-4 animate-in fade-in slide-in-from-top-2">
          <Link href="/" onClick={close}>
            Home
          </Link>
          <Link href="/archive" onClick={close}>
            Archive
          </Link>
          <Link href="/games" onClick={close}>
            Games
          </Link>
          <Link href="/users" onClick={close}>
            Users
          </Link>
          <Link href="/stats" onClick={close}>
            Stats
          </Link>
          <Link href="/playlists" onClick={close}>
            Playlists
          </Link>
          <div onClick={close}>
            <SettingsLink />
          </div>
        </div>
      )}
    </div>
  );
}
