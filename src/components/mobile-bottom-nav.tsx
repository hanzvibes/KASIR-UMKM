"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Package, ReceiptText, ShoppingCart, Wallet } from "lucide-react";

const items = [
  { label: "Kasir", short: "Kasir", href: "/checkout", Icon: ShoppingCart },
  { label: "Transaksi", short: "Transaksi", href: "/sales", Icon: ReceiptText },
  { label: "Produk", short: "Produk", href: "/products", Icon: Package },
  { label: "Pengeluaran", short: "Biaya", href: "/expenses", Icon: Wallet },
  { label: "Laporan", short: "Laporan", href: "/reports", Icon: BarChart3 },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_rgba(23,35,29,0.05)] backdrop-blur md:hidden">
      {items.map(({ label, short, href, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95 ${active ? "text-brand" : "text-muted hover:text-ink"}`}>
            <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
            <span>{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
