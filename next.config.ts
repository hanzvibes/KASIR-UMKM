import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["pv-3e3a4c470b12-6aefc408-2bb0-4f84-8dea-dfcf6bb1c8c3.style.dev"],
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: false,
  globPublicPatterns: ["icons/**", "apple-touch-icon.png", "offline.html"],
});

export default withSerwist(nextConfig);
