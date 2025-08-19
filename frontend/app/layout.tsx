import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import type { ReactNode } from "react";
import "./globals.css";
import AuthStatus from "@/components/AuthStatus";
import MobileMenu from "@/components/MobileMenu";
import MainNav from "@/components/MainNav";
import TwitchVideos from "@/components/TwitchVideos";
import TwitchClips from "@/components/TwitchClips";
import EventLog from "@/components/EventLog";
import Eruda from "@/components/Eruda";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import { SocialLink } from "@/components/SocialLink";
import ActivitySheet from "@/components/ActivitySheet";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "Terrenkur",
  description: "Random game roulette",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  let defaultTheme = "system";
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  const resolvedLocale = cookieStore.get("i18nextLng")?.value ?? "ru";
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (token && backendUrl) {
    try {
      const resp = await fetch(`${backendUrl}/api/user/theme`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (resp.ok) {
        const data = await resp.json();
        if (typeof data.theme === "string") defaultTheme = data.theme;
      }
    } catch {
      // ignore
    }
  }

  return (
    <html lang={resolvedLocale}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased flex flex-col`}
      >
        <ThemeProvider defaultTheme={defaultTheme}>
          <I18nProvider>
            <Eruda />
            <header className="bg-muted text-foreground border-b p-4 relative z-20">
              <nav className="flex items-center">
                <div className="flex items-center flex-shrink-0">
                  <MobileMenu />
                  <div className="hidden md:flex space-x-4">
                    <MainNav />
                  </div>
                </div>
                <a
                  href="https://www.twitch.tv/terrenkur"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex justify-center"
                >
                  <Image src="/logo.png" alt="Terrenkur" className="w-full max-w-[calc(100%-2rem)] h-auto" />
                </a>
                <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
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
              <div
                className="container mx-auto px-0 grid grid-cols-1 md:grid-cols-12 gap-x-2 gap-y-4 items-start min-h-[calc(100vh-64px)]"
              >
                <div className="col-span-12 md:col-span-9 bg-muted rounded-lg p-4 h-full">
                  {children}
                </div>
                <div className="hidden md:block col-span-12 md:col-span-3 md:col-start-10 space-y-4 bg-muted rounded-lg p-4 h-full">
                  <EventLog />
                  <TwitchVideos />
                  <TwitchClips />
                </div>
              </div>
              <ActivitySheet />
            </main>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

