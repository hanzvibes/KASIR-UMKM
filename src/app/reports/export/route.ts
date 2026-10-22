import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const safe = (value: string | number | null) => {
  const text = String(value ?? "").replace(/[\r\n]/g, " ").replace(/"/g, '""');
  return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  const supabase = await createClient();
  const [{ data: { user } }, { data: members }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("kasir_get_my_business")]);
  if (!user) return NextResponse.json({ error: "Silakan masuk" }, { status: 401 });
  const member = members?.[0];
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const start = `${from}T00:00:00+07:00`;
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000).toISOString();
  const [{ data: sales, error: salesError }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from("kasir_sales").select("id,created_at,total_amount,payment_method,status").eq("business_id", member.business_id).gte("created_at", start).lt("created_at", end).order("created_at").range(0,4999),
    supabase.from("kasir_expenses").select("expense_date,category,description,amount").eq("business_id", member.business_id).gte("expense_date", from).lte("expense_date", to).order("expense_date").range(0,4999),
  ]);
  if (salesError || expensesError) return NextResponse.json({ error: "Laporan belum bisa dimuat" }, { status: 500 });
  const rows = ["Jenis,Tanggal,Nomor,Metode atau kategori,Nominal,Catatan"];
  for (const sale of sales ?? []) rows.push(["Penjualan",new Date(sale.created_at).toISOString(),sale.id,sale.payment_method,sale.status === "completed" ? sale.total_amount : 0,sale.status].map(safe).join(","));
  for (const expense of expenses ?? []) rows.push(["Pengeluaran",expense.expense_date,"",expense.category,expense.amount,expense.description].map(safe).join(","));
  return new NextResponse(`\uFEFF${rows.join("\r\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="laporan-${from}-${to}.csv"`, "cache-control": "private, no-store" } });
}
