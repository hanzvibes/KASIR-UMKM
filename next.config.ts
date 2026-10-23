import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["pv-b3987d022a25-dea37420-78b0-4fa4-9445-d959237b4fa3.style.dev"],
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: false,
  globPublicPatterns: ["icons/**", "apple-touch-icon.png", "offline.html"],
});

export default withSerwist(nextConfig);
