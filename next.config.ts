import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["pv-69494b7baab8-077bd9bc-27b1-4e96-a190-4ac062df0309.style.dev"],
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: false,
  globPublicPatterns: ["icons/**", "apple-touch-icon.png", "offline.html"],
});

export default withSerwist(nextConfig);
