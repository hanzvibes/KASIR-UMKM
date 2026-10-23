import { notFound } from "next/navigation";
import Image from "next/image";
import { Bluetooth, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodLabel } from "@/lib/pos";

type Params = Promise<{ token: string }>;
type Receipt = { sale: { invoice_no: string | null; total_amount: number; discount: number; payment_method: string; created_at: string; status: string; cash_received: number | null; change_due: number }; business: { name: string; phone: string | null; logo_url: string | null; receipt_footer: string | null; receipt_width: number }; items: { name: string; unit: string; quantity: number; price: number; total: number }[] };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default async function PublicReceiptPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kasir_public_receipt", { p_token: token });
  if (error || !data || typeof data !== "object") notFound();
  const receipt = data as Receipt;
  return <main className="min-h-screen bg-neutral-100 p-4 print:min-h-0 print:bg-white print:p-0"><div className="mx-auto mb-3 flex w-full max-w-[80mm] items-center justify-end gap-2 print:hidden"><button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><Printer size={16} /> Cetak struk 80 mm</button><span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700"><Bluetooth size={15} /> Bluetooth</span></div><article data-thermal-receipt style={{ "--receipt-width": `${receipt.business.receipt_width}mm` } as React.CSSProperties} className="mx-auto w-full max-w-[var(--receipt-width)] bg-white p-5 text-sm text-black shadow print:max-w-none print:shadow-none print:[width:var(--receipt-width)]"><header className="text-center">{receipt.business.logo_url && <Image src={receipt.business.logo_url} alt="" width={128} height={64} unoptimized className="mx-auto mb-2 max-h-16 max-w-32 object-contain" />}<h1 className="text-lg font-bold">{receipt.business.name}</h1>{receipt.business.phone && <p>{receipt.business.phone}</p>}<p className="mt-3">{receipt.sale.invoice_no ?? "Struk pembayaran"}</p><p>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(receipt.sale.created_at))}</p></header><div className="receipt-items my-4 border-y border-dashed py-3">{receipt.items.map((item,index)=><div key={index} className="receipt-line mb-3 last:mb-0"><div>{item.name}</div><div className="flex justify-between"><span>{item.quantity} {item.unit} × {money(item.price)}</span><span>{money(item.total)}</span></div></div>)}</div>{receipt.sale.discount > 0 && <div className="flex justify-between py-1"><span>Diskon</span><span>−{money(receipt.sale.discount)}</span></div>}<div className="receipt-total flex justify-between text-base font-bold"><span>Total</span><span>{money(receipt.sale.total_amount)}</span></div><p className="mt-2 text-center">{paymentMethodLabel(receipt.sale.payment_method)}</p>{receipt.business.receipt_footer && <p className="mt-5 whitespace-pre-wrap text-center">{receipt.business.receipt_footer}</p>}<p className="mt-5 text-center text-xs text-neutral-500 print:hidden">Struk digital</p></article></main>;
}
