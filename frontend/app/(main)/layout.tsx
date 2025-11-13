import Image from "next/image";
import type { ReactNode } from "react";
import AuthStatus from "@/components/AuthStatus";
import MobileMenu from "@/components/MobileMenu";
import MainNav from "@/components/MainNav";
import TwitchVideos from "@/components/TwitchVideos";
import TwitchClips from "@/components/TwitchClips";
import EventLog from "@/components/EventLog";
import ThemeToggle from "@/components/ThemeToggle";
import { SocialLink } from "@/components/SocialLink";
import ActivitySheet from "@/components/ActivitySheet";

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-20 border-b bg-muted p-4 text-foreground">
        <nav className="flex items-center">
          <div className="flex flex-shrink-0 items-center">
            <MobileMenu />
            <div className="hidden space-x-4 md:flex">
              <MainNav />
            </div>
          </div>
          <a
            href="https://www.twitch.tv/terrenkur"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 justify-center"
          >
            <Image
              src="/logo.png"
              alt="Terrenkur"
              className="max-h-12 w-auto"
              height={48}
              width={160}
            />
          </a>
          <div className="flex flex-shrink-0 items-center space-x-2 sm:space-x-4">
            <SocialLink
              href="https://www.donationalerts.com/r/terrenkur"
              src="/icons/socials/DA.svg"
              alt="Donations Alerts"
              ariaLabel="Donationalerts"
            />
            <SocialLink
              href="https://t.me/terenkur"
              src="/icons/socials/telegram.svg"
              alt="Telegram"
              ariaLabel="Telegram"
            />
            <SocialLink
              href="https://discord.gg/eWwk2wAYBf"
              src="/icons/socials/discord.svg"
              alt="Discord"
              ariaLabel="Discord"
            />
            <ThemeToggle />
            <AuthStatus />
          </div>
        </nav>
      </header>
      <main className="mt-4 flex-grow">
        <div className="container mx-auto grid min-h-[calc(100vh-64px)] grid-cols-1 items-start gap-x-2 gap-y-4 px-0 md:grid-cols-12">
          <div className="col-span-12 h-full rounded-lg bg-muted p-4 md:col-span-9">
            {children}
          </div>
          <div className="hidden h-full space-y-4 rounded-lg bg-muted p-4 md:col-span-3 md:col-start-10 md:block">
            <EventLog />
            <TwitchVideos />
            <TwitchClips />
          </div>
        </div>
        <ActivitySheet />
      </main>
    </div>
  );
}
