import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronRight,
  CircleHelp,
  Clock3,
  Package,
  Settings,
  Store,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";

type ManageItem = {
  href: string;
  title: string;
  description: string;
  icon: typeof Package;
  ownerOnly?: boolean;
};
type ManageGroup = { title: string; items: ManageItem[] };

const groups: ManageGroup[] = [
  {
    title: "Operasional",
    items: [
      {
        href: "/products",
        title: "Produk & stok",
        description: "Katalog, harga, kategori, dan varian",
        icon: Package,
      },
    ],
  },
  {
    title: "Keuangan",
    items: [
      {
        href: "/expenses",
        title: "Pengeluaran",
        description: "Catat biaya operasional usaha",
        icon: Wallet,
      },
    ],
  },
  {
    title: "Usaha & akun",
    items: [
      {
        href: "/settings",
        title: "Pengaturan usaha",
        description: "Profil, QRIS, dan tampilan struk",
        icon: Settings,
      },
      {
        href: "/users",
        title: "Akun kasir",
        description: "Undang dan atur akses karyawan",
        icon: Users,
        ownerOnly: true,
      },
      {
        href: "/help",
        title: "Bantuan",
        description: "Panduan singkat penggunaan kasir",
        icon: CircleHelp,
      },
    ],
  },
];

const jakartaTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));

export default async function ManagePage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: memberships }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("kasir_get_my_business"),
  ]);
  if (!user) redirect("/login");
  const membership = memberships?.[0];
  if (!membership) redirect("/onboarding");

  const [{ data: business, error: businessError }, { data: activeShift, error: shiftError }, { count: lowStockCount, error: stockError }] = await Promise.all([
    supabase.from("kasir_businesses").select("name").eq("id", membership.business_id).maybeSingle(),
    supabase
      .from("kasir_shifts")
      .select("id, opened_at")
      .eq("business_id", membership.business_id)
      .eq("cashier_id", user.id)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("kasir_products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", membership.business_id)
      .eq("is_active", true)
      .eq("track_stock", true)
      .is("deleted_at", null)
      .lte("stock_qty", 5),
  ]);

  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.ownerOnly || membership.role === "owner") }))
    .filter((group) => group.items.length > 0);

  return (
    <main className="min-h-screen bg-canvas pb-24 md:pb-28">
      <PageHeader title="Kelola usaha" subtitle={business?.name ?? "Semua fitur dalam satu tempat"} />

      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-7">
        {(businessError || shiftError || stockError) && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>Sebagian status usaha belum termuat.</strong> Muat ulang untuk memastikan informasi shift dan stok terbaru.</div>}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Store size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {membership.role === "owner" ? "Pemilik usaha" : "Kasir"}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold">{business?.name ?? "Usaha kamu"}</h2>
              <p className="mt-1 text-sm text-muted">
                {activeShift
                  ? `Kasir sedang dibuka sejak ${jakartaTime(activeShift.opened_at)}.`
                  : "Kasir belum dibuka hari ini."}
              </p>
            </div>
          </div>
          <Link
            href="/checkout"
            prefetch={true}
            className="press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white transition hover:bg-[#196640]"
          >
            <Clock3 size={17} />
            {activeShift ? "Buka halaman kasir" : "Buka kasir sekarang"}
          </Link>
        </section>

        {typeof lowStockCount === "number" && lowStockCount > 0 ? (
          <Link
            href="/products"
            prefetch={true}
            className="press flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <TriangleAlert size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 font-medium">
              {lowStockCount} produk aktif stoknya tinggal 5 atau kurang. Buka daftar stok untuk memeriksa dan memperbarui jumlahnya.
            </span>
            <ChevronRight size={17} className="shrink-0" />
          </Link>
        ) : null}

        {visibleGroups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{group.title}</h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
              {group.items.map(({ href, title, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={true}
                  className="group flex items-center gap-3 border-b border-line p-4 last:border-b-0 transition-colors hover:bg-canvas active:bg-brand-soft/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft/70 text-brand">
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
