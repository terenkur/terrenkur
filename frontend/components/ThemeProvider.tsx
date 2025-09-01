"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useEffect } from "react";

function ThemeLoader() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sb-access-token="))
      ?.split("=")[1];
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (token && backendUrl) {
      fetch(`${backendUrl}/api/user/theme`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((resp) => (resp.ok ? resp.json() : null))
        .then((data) => {
          if (data && typeof data.theme === "string") setTheme(data.theme);
        })
        .catch(() => {
          // ignore
        });
    }
  }, [setTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey="theme"
      defaultTheme="system"
      {...props}
    >
      <ThemeLoader />
      {children}
    </NextThemesProvider>
  );
}
