import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import PrintReceiptButton from "./print-button";
import { voidSaleAction } from "../actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; success?: string }>;
const money = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function SaleReceiptPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const [
    { data: { user }, error: authError },
    { data: sale, error },
    { data: memberships, error: membershipError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("kasir_sales")
      .select("id, business_id, payment_method, total_amount, cash_received, change_due, created_at, status, void_reason")
      .eq("id", id).maybeSingle(),
    supabase.rpc("kasir_get_my_business"),
  ]);
  if (authError || !user) redirect("/login");
  if (error || !sale) notFound();
  const membership = memberships?.[0];
  if (membershipError || !membership || membership.business_id !== sale.business_id) notFound();
  const { data: items, error: itemsError } = await supabase.from("kasir_sale_items")
    .select("id, product_name, unit, quantity, unit_price, line_total")
    .eq("sale_id", sale.id).order("created_at");

  if (itemsError) notFound();

  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.created_at));
  const paymentLabel = sale.payment_method === "cash" ? "Tunai" : sale.payment_method === "transfer" ? "Transfer" : "Lainnya";
  const isVoided = sale.status === "voided";

  return (
    <main className="min-h-screen bg-canvas p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href="/checkout" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={17} /> Kembali ke kasir</Link>
          <PrintReceiptButton />
        </div>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-8 print:border-0 print:shadow-none">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand"><CheckCircle2 size={26} /></span>
            <h1 className="mt-3 text-xl font-bold">{isVoided ? "Transaksi dibatalkan" : "Transaksi berhasil"}</h1>
            <p className="mt-1 text-sm text-muted">Struk pembayaran</p>
            <p className="mt-4 font-mono text-sm">#{sale.id.slice(0, 8).toUpperCase()}</p>
            <p className="mt-1 text-xs text-muted">{date}</p>
          </div>
          <div className="my-6 border-y border-dashed border-line py-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted">Pembayaran</span><span className="font-medium">{paymentLabel}</span></div>
            <div className="mt-2 flex justify-between gap-4"><span className="text-muted">Uang diterima</span><span className="font-medium">{sale.payment_method === "cash" ? money(sale.cash_received) : "—"}</span></div>
            {sale.payment_method === "cash" && <div className="mt-2 flex justify-between gap-4"><span className="text-muted">Kembalian</span><span className="font-semibold">{money(sale.change_due)}</span></div>}
            <div className="mt-2 flex justify-between gap-4"><span className="text-muted">Status</span><span className={`font-semibold ${isVoided ? "text-red-700" : "text-green-700"}`}>{isVoided ? "Dibatalkan" : "Tersimpan"}</span></div>
          </div>
          <div className="space-y-4">
            {(items ?? []).map((item) => <div key={item.id} className="flex justify-between gap-4 text-sm">
              <div className="min-w-0"><p className="font-medium">{item.product_name}</p><p className="mt-1 text-xs text-muted">{item.quantity} {item.unit} × {money(item.unit_price)}</p></div>
              <span className="shrink-0 font-semibold">{money(item.line_total)}</span>
            </div>)}
          </div>
          <div className="mt-6 border-t border-line pt-4"><div className="flex justify-between text-base"><span className="font-semibold">Total</span><strong className="text-xl">{money(sale.total_amount)}</strong></div></div>
          {isVoided && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Alasan pembatalan: {sale.void_reason || "—"}</p>}
          {query.success === "voided" && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Transaksi dibatalkan dan stok tercatat kembali.</p>}
          {query.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{query.error === "owner_only" ? "Hanya pemilik usaha yang boleh membatalkan transaksi." : query.error === "invalid_reason" ? "Alasan wajib diisi (3–240 karakter)." : query.error === "already_voided" ? "Transaksi ini sudah dibatalkan." : "Pembatalan gagal. Pastikan migrasi pembatalan sudah diterapkan."}</p>}
          <p className="mt-8 text-center text-xs text-muted">{isVoided ? "Transaksi ini sudah dibatalkan." : "Terima kasih sudah berbelanja."}</p>
        </section>
        {!isVoided && membership.role === "owner" && <form action={voidSaleAction} className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-white p-4 print:hidden"><h2 className="font-semibold text-red-800">Batalkan transaksi</h2><p className="text-sm text-muted">Gunakan hanya untuk transaksi yang keliru. Stok akan dikembalikan dan pembatalan dicatat.</p><input type="hidden" name="sale_id" value={sale.id} /><label className="grid gap-1.5 text-sm font-medium">Alasan pembatalan *<textarea name="reason" required minLength={3} maxLength={240} className="min-h-20 rounded-xl border border-line p-3 font-normal" placeholder="Contoh: transaksi salah input" /></label><button type="submit" className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Batalkan transaksi</button></form>}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row print:hidden">
          <Link href="/checkout" className="flex-1 rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white">Transaksi baru</Link>
          <Link href="/sales" className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-center text-sm font-semibold">Riwayat transaksi</Link>
        </div>
      </div>
      <MobileBottomNav />
    </main>
  );
}
