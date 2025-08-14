import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // i18n: {
  //   locales: ["ru"],
  //   defaultLocale: "ru",
  // },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
