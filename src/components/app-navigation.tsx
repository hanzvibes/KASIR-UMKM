"use client";

import { usePathname } from "next/navigation";
import MobileBottomNav from "@/components/mobile-bottom-nav";

const publicRoutes = ["/", "/login", "/onboarding", "/privacy", "/terms"];

export default function AppNavigation() {
  const pathname = usePathname();
  if (publicRoutes.includes(pathname) || pathname.startsWith("/r/")) return null;
  return <MobileBottomNav />;
}
