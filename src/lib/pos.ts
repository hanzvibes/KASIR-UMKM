export type DiscountError = "invalid" | "over_subtotal" | null;

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
