"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, MoreHorizontal, Package, ReceiptText, ShoppingCart, Wallet, Clock3, CircleHelp, Settings, Users } from "lucide-react";
import { useState } from "react";

const primaryItems = [
  { label: "Kasir", short: "Kasir", href: "/checkout", Icon: ShoppingCart },
  { label: "Transaksi", short: "Transaksi", href: "/sales", Icon: ReceiptText },
];
const moreItems = [
  { label: "Buka / tutup kasir", href: "/shifts", Icon: Clock3, description: "Catat modal awal dan tutup shift" },
  { label: "Produk & stok", href: "/products", Icon: Package, description: "Kelola katalog dan stok barang" },
  { label: "Ringkasan usaha", href: "/dashboard", Icon: LayoutDashboard, description: "Lihat performa usaha" },
  { label: "Pengeluaran", href: "/expenses", Icon: Wallet, description: "Catat biaya operasional" },
  { label: "Laporan", href: "/reports", Icon: BarChart3, description: "Rekap penjualan dan biaya" },
  { label: "Bantuan", href: "/help", Icon: CircleHelp, description: "Panduan singkat penggunaan" },
  { label: "Pengaturan usaha", href: "/settings", Icon: Settings, description: "Profil dan struk usaha" },
  { label: "Akun kasir", href: "/users", Icon: Users, description: "Undang dan atur akses karyawan" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const inMoreSection = moreItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setMenuOpen(false)} role="presentation">
          <section role="dialog" aria-label="Menu lainnya" className={`absolute inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] rounded-2xl border border-line bg-white p-3 shadow-2xl ${pathname === "/dashboard" ? "md:hidden" : "md:inset-x-auto md:bottom-24 md:left-1/2 md:right-auto md:w-[640px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2"}`} onClick={(event) => event.stopPropagation()}>
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-muted">Kelola usaha</p>
            <div className="space-y-1">
              {moreItems.map(({ label, href, Icon, description }) => (
                <Link key={href} href={href} prefetch={false} onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${pathname === href ? "bg-brand-soft text-brand" : "text-ink hover:bg-canvas"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas"><Icon size={19} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs text-muted">{description}</span></span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
      <nav aria-label="Navigasi utama" className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-line bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_rgba(23,35,29,0.05)] backdrop-blur md:inset-x-auto md:left-1/2 md:right-auto md:bottom-4 md:w-[480px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:rounded-2xl md:border md:px-3 md:shadow-xl ${pathname === "/dashboard" ? "md:hidden" : ""}`}>
        {primaryItems.map(({ label, short, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} prefetch={false} aria-label={label} aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95 ${active ? "bg-brand-soft/80 text-brand" : "text-muted hover:bg-canvas hover:text-ink"}`}>
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
              <span>{short}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Kelola usaha"
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95 ${menuOpen || inMoreSection ? "bg-brand-soft/80 text-brand" : "text-muted hover:bg-canvas hover:text-ink"}`}>
          <MoreHorizontal size={20} strokeWidth={menuOpen || inMoreSection ? 2.3 : 1.8} aria-hidden="true" />
          <span>Kelola</span>
        </button>
      </nav>
    </>
  );
}
