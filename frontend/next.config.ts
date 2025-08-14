import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // i18n: {
  //   locales: ["en", "ru"],
  //   defaultLocale: "en",
  // },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
