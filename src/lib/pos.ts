export type DiscountError = "invalid" | "over_subtotal" | null;

/** Stock at or below this level needs a refill before the next busy hour. */
export const LOW_STOCK_THRESHOLD = 5;

export type StockState = "untracked" | "out" | "low" | "ok";

type StockProduct = { track_stock: boolean; stock_qty: number | string | null };

/** Single source of truth for the stock badges on products and reports. */
export function stockState(product: StockProduct): StockState {
  if (!product.track_stock) return "untracked";
  const stock = product.stock_qty === null ? 0 : Number(product.stock_qty);
  if (!Number.isFinite(stock) || stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

/**
 * Search terms are interpolated into a PostgREST filter, so strip the
 * characters that can break the filter (`%`, commas, parens) while keeping
 * spaces and SKU punctuation.
 */
export function sanitizeSearchTerm(input: string, maxLength = 80): string {
  return input.trim().replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, maxLength);
}

/** Shared label so legacy `other` rows are never shown as QRIS or transfer. */
export function paymentMethodLabel(method: string): string {
  if (method === "cash") return "Tunai";
  if (method === "qris") return "QRIS";
  if (method === "transfer") return "Transfer";
  if (method === "other") return "Lainnya";
  return "Metode lain";
}

/** Validates the quick restock input shown next to low-stock products. */
export function parseStockAdjustment(input: string): { amount: number; error: "invalid" | null } {
  const value = input.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return { amount: 0, error: "invalid" };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return { amount: 0, error: "invalid" };
  return { amount, error: null };
}

/**
 * Parses the discount field as cashiers type it. An empty field means "no
 * discount" rather than an error, matching the checkout form's default.
 */
export function parseDiscountInput(input: string, subtotal: number): { amount: number; error: DiscountError } {
  const value = input.trim();
  if (value === "") return { amount: 0, error: null };
  if (!/^\d+$/.test(value)) return { amount: 0, error: "invalid" };
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) return { amount: 0, error: "invalid" };
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) return { amount: 0, error: "invalid" };
  if (amount > subtotal) return { amount, error: "over_subtotal" };
  return { amount, error: null };
}

/** Cash denominations that make sense to offer for a given bill. */
export function buildQuickCashOptions(total: number): number[] {
  if (!Number.isSafeInteger(total) || total <= 0) return [];
  const roundUp = (step: number) => Math.ceil(total / step) * step;
  const options = [total, roundUp(10_000), roundUp(20_000), roundUp(50_000), roundUp(100_000)];
  return [...new Set(options)]
    .filter((amount) => Number.isSafeInteger(amount) && amount >= total)
    .sort((a, b) => a - b);
}

/** Change owed for a cash payment, or null when the entered cash is insufficient. */
export function calculateChange(cashReceived: number | null, total: number): number | null {
  if (cashReceived === null || !Number.isSafeInteger(cashReceived) || !Number.isSafeInteger(total)) return null;
  if (cashReceived < total) return null;
  return cashReceived - total;
}
