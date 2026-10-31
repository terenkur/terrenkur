"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import TwitchVideos from "@/components/TwitchVideos";
import TwitchClips from "@/components/TwitchClips";
import EventLog from "@/components/EventLog";
import { SocialLink } from "@/components/SocialLink";
import ActivitySheet from "@/components/ActivitySheet";

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const home = usePathname() === "/";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-20 border-b bg-muted text-foreground">
        <nav className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 lg:gap-x-6">
          <Link href="/" aria-label="Terrenkur — главная" className="shrink-0 rounded">
            <Image src="/logo.png" alt="Terrenkur" className="h-9 w-auto" height={48} width={160} />
          </Link>
          <MobileMenu />
          <div className="flex w-full items-center justify-between gap-1 border-t pt-1 md:justify-center md:gap-4 xl:w-auto xl:border-0 xl:pt-0">
            <SocialLink href="https://www.twitch.tv/terrenkur" src="/icons/socials/twitch.svg" label="Twitch" />
            <SocialLink href="https://t.me/terenkur" src="/icons/socials/telegram.svg" label="Telegram" />
            <SocialLink href="https://discord.gg/eWwk2wAYBf" src="/icons/socials/discord.svg" label="Discord" />
            <SocialLink href="https://www.donationalerts.com/r/terrenkur" src="/icons/socials/DA.svg" label="Донат" donation />
          </div>
        </nav>
      </header>
      <main className="mt-4 min-w-0 flex-grow">
        <ActivitySheet />
        <div className="container mx-auto grid min-h-[calc(100vh-64px)] grid-cols-1 items-start gap-x-2 gap-y-4 px-0 md:grid-cols-12">
          <div className={`col-span-1 min-w-0 h-full rounded-lg bg-muted p-4 ${home ? "md:col-span-12" : "md:col-span-9"}`}>
            {children}
          </div>
          <div className={`hidden min-w-0 rounded-lg bg-muted p-4 ${home ? "md:col-span-12 md:grid md:grid-cols-2 md:gap-4" : "h-full space-y-4 md:col-span-3 md:col-start-10 md:block"}`}>
            {!home && <EventLog />}
            <TwitchVideos />
            <TwitchClips />
          </div>
        </div>
      </main>
    </div>
  );
}
