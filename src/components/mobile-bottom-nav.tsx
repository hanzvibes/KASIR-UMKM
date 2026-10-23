"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ReceiptText, ShoppingCart, TrendingUp } from "lucide-react";

const items = [
  { label: "Kasir", href: "/checkout", Icon: ShoppingCart },
  { label: "Laporan", href: "/reports", Icon: TrendingUp },
  { label: "Kelola", href: "/manage", Icon: LayoutGrid },
  { label: "Lainnya", href: "/sales", Icon: ReceiptText },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_rgba(23,35,29,0.06)] backdrop-blur md:bottom-4 md:left-1/2 md:right-auto md:inset-x-auto md:w-[520px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:rounded-2xl md:border md:p-1.5 md:shadow-xl"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4 gap-1 px-2 md:px-0">
        {items.map(({ label, href, Icon }) => {
          const active = label === "Lainnya" ? pathname.startsWith("/sales") || pathname.startsWith("/shifts") : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={true}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors active:scale-[0.98] ${
                  active ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" className={`transition-transform duration-200 ${active ? "scale-110" : "scale-100"}`} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
