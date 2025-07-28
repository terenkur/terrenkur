import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Terrenkur",
  description: "Random game roulette",
  viewport: "width=device-width, initial-scale=1",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="bg-gray-100 dark:bg-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 p-4">
          <nav className="flex justify-between items-center">
            <div className="flex space-x-4">
              <Link href="/">Home</Link>
              <Link href="/archive">Archive</Link>
              <Link href="/games">Games</Link>
              <Link href="/users">Users</Link>
              <Link href="/playlists">Playlists</Link>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="https://twitch.tv/terrenkur"
                target="_blank"
                rel="noopener noreferrer"
              >
                Twitch
              </a>
              <a
                href="https://t.me/terenkur"
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
              <a
                href="https://discord.gg/eWwk2wAYBf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord
              </a>
              <AuthStatus />
            </div>
          </nav>
        </header>
        <main className="mt-4">
          {children}
        </main>
      </body>
    </html>
  );
}
