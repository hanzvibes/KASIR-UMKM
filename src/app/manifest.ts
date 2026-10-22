import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kasir UMKM",
    short_name: "Kasir UMKM",
    description: "Kasir sederhana untuk usaha kecil Indonesia.",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#1d754b",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
