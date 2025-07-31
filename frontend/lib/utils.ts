import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function proxiedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  return url.startsWith("http") && backendUrl
    ? `${backendUrl}/api/proxy?url=${encodeURIComponent(url)}`
    : url;
}
