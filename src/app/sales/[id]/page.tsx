import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PrintReceiptButton from "./print-button";

type Params = Promise<{ id: string }>;
const money = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function SaleReceiptPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: sale, error } = await supabase.from("sales")
    .select("id, receipt_no, payment_method, subtotal, total, status, created_at")
    .eq("id", id).maybeSingle();
  if (error || !sale) notFound();

  const { data: items } = await supabase.from("sale_items")
    .select("id, product_name, sku, unit, quantity, unit_price, line_total")
    .eq("sale_id", sale.id).order("created_at");

  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.created_at));
  const paymentLabel = sale.payment_method === "cash" ? "Tunai" : sale.payment_method === "transfer" ? "Transfer" : "Lainnya";

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
            <h1 className="mt-3 text-xl font-bold">Transaksi berhasil</h1>
            <p className="mt-1 text-sm text-muted">Struk pembayaran</p>
            <p className="mt-4 font-mono text-sm">#{sale.receipt_no}</p>
            <p className="mt-1 text-xs text-muted">{date}</p>
          </div>
          <div className="my-6 border-y border-dashed border-line py-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted">Pembayaran</span><span className="font-medium">{paymentLabel}</span></div>
            <div className="mt-2 flex justify-between gap-4"><span className="text-muted">Status</span><span className={`font-semibold ${sale.status === "completed" ? "text-green-700" : "text-muted"}`}>{sale.status === "completed" ? "Lunas" : "Dibatalkan"}</span></div>
          </div>
          <div className="space-y-4">
            {(items ?? []).map((item) => <div key={item.id} className="flex justify-between gap-4 text-sm">
              <div className="min-w-0"><p className="font-medium">{item.product_name}</p><p className="mt-1 text-xs text-muted">{item.quantity} {item.unit} × {money(item.unit_price)}</p></div>
              <span className="shrink-0 font-semibold">{money(item.line_total)}</span>
            </div>)}
          </div>
          <div className="mt-6 border-t border-line pt-4"><div className="flex justify-between text-base"><span className="font-semibold">Total</span><strong className="text-xl">{money(sale.total)}</strong></div></div>
          <p className="mt-8 text-center text-xs text-muted">Terima kasih sudah berbelanja.</p>
        </section>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row print:hidden">
          <Link href="/checkout" className="flex-1 rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white">Transaksi baru</Link>
          <Link href="/sales" className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-center text-sm font-semibold">Riwayat transaksi</Link>
        </div>
      </div>
    </main>
  );
}
