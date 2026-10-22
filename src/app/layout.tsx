import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kasir UMKM",
  description: "Kasir sederhana untuk usaha kecil Indonesia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
