import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function proxiedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return url;

  try {
    const { hostname } = new URL(url);
    const allowed = [
      "static-cdn.jtvnw.net",
      "clips-media-assets2.twitch.tv",
      "media.rawg.io",
    ];
    if (allowed.includes(hostname)) {
      return `${backendUrl}/api/proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Ignore invalid URLs and return as is
  }
  return url;
}
