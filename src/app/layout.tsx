import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaControls from "@/shared/ui/pwa-controls";
import AppNavigation from "@/components/app-navigation";

export const metadata: Metadata = {
  title: "Kasir UMKM",
  description: "Kasir sederhana untuk usaha kecil Indonesia.",
  applicationName: "Kasir UMKM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kasir UMKM",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d754b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}<AppNavigation /><PwaControls /></body>
    </html>
  );
}
