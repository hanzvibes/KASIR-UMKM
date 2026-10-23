import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const [{ data: { user }, error: authError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("kasir_get_my_business"),
  ]);
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = memberships?.[0];
  if (membershipError || !membership) return NextResponse.json({ error: "business_not_found" }, { status: 403 });

  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const pageSize = 30;
  const { data, error } = await supabase.from("kasir_sales")
    .select("id, invoice_no, payment_method, total_amount, created_at, status")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize);
  if (error) return NextResponse.json({ error: "sales_load_failed" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });

  const fetchedSales = data ?? [];
  return NextResponse.json({
    sales: fetchedSales.slice(0, pageSize).map((sale) => ({ ...sale, total_amount: Number(sale.total_amount) })),
    hasNextPage: fetchedSales.length > pageSize,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
