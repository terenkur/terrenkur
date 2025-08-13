import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import SettingsLink from "@/components/SettingsLink";
import MobileMenu from "@/components/MobileMenu";
import TwitchVideos from "@/components/TwitchVideos";
import TwitchClips from "@/components/TwitchClips";
import EventLog from "@/components/EventLog";
import Eruda from "@/components/Eruda";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Terrenkur",
  description: "Random game roulette",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased flex flex-col`}
      >
        <ThemeProvider>
          <Eruda />
          <header className="bg-muted text-foreground border-b p-4">
            <nav className="flex justify-between items-center relative">
              <div className="flex items-center">
                <MobileMenu />
                <div className="hidden md:flex space-x-4">
                  <Link href="/">Home</Link>
                  <Link href="/archive">Archive</Link>
                  <Link href="/games">Games</Link>
                  <Link href="/users">Users</Link>
                  <Link href="/stats">Stats</Link>
                  <Link href="/playlists">Playlists</Link>
                  <SettingsLink />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <a
                  href="https://www.donationalerts.com/r/terrenkur"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
                >
                  <img
                    src="/icons/socials/DA.svg"
                    alt="Donations Alerts"
                    className="w-6 h-6"
                  />
                </a>
                <a
                  href="https://t.me/terenkur"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
                >
                  <img
                    src="/icons/socials/telegram.svg"
                    alt="Telegram"
                    className="w-6 h-6"
                  />
                </a>
                <a
                  href="https://discord.gg/eWwk2wAYBf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
                >
                  <img
                    src="/icons/socials/discord.svg"
                    alt="Discord"
                    className="w-6 h-6"
                  />
                </a>
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
              <div className="order-last md:order-none md:hidden col-span-12 space-y-4 bg-muted rounded-lg p-4 h-full">
                <EventLog />
                <TwitchVideos />
                <TwitchClips />
              </div>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
