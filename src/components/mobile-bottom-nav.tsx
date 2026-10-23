"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ReceiptText, ShoppingCart } from "lucide-react";

const items = [
  { label: "Kasir", href: "/checkout", Icon: ShoppingCart },
  { label: "Riwayat", href: "/sales", Icon: ReceiptText },
  { label: "Lainnya", href: "/manage", Icon: LayoutGrid },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/90 bg-white/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(23,35,29,0.07)] backdrop-blur-xl md:bottom-4 md:left-1/2 md:right-auto md:inset-x-auto md:w-[520px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:rounded-2xl md:border md:border-white/70 md:p-1.5 md:shadow-xl xl:bottom-6 xl:left-6 xl:right-auto xl:top-1/2 xl:w-20 xl:-translate-y-1/2 xl:translate-x-0 xl:rounded-2xl xl:px-1 xl:py-2"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-3 gap-1 px-2 md:px-0 xl:grid-cols-1">
        {items.map(({ label, href, Icon }) => {
          const active = label === "Lainnya"
            ? ["/manage", "/reports", "/dashboard", "/products", "/expenses", "/settings", "/users", "/help", "/shifts"].some((route) => pathname === route || pathname.startsWith(`${route}/`))
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={true}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors active:scale-[0.98] xl:min-h-16 ${
                  active ? "bg-brand-soft/90 text-brand shadow-sm" : "text-muted hover:bg-canvas hover:text-ink"
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
