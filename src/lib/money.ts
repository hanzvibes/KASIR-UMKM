export function formatIDR(amount: number): string {
  if (!Number.isFinite(amount)) throw new TypeError("Amount must be finite");
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export type CartLine = { unitPrice: number; quantity: number };

export function calculateSubtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError("Quantity must be a positive integer");
    }
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new RangeError("Unit price must be a non-negative integer in IDR");
    }
    return total + line.unitPrice * line.quantity;
  }, 0);
}

export function calculateTotal(subtotal: number, discount: number): number {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new RangeError("Invalid subtotal");
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal) {
    throw new RangeError("Discount must be between zero and subtotal");
  }
  return subtotal - discount;
}
