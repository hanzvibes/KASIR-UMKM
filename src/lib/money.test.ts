import { describe, expect, it } from "vitest";
import { calculateSubtotal, calculateTotal, formatIDR } from "./money";

describe("money helpers", () => {
  it("formats IDR without fractional rupiah", () => {
    expect(formatIDR(12500)).toContain("12.500");
  });

  it("calculates cart subtotal", () => {
    expect(calculateSubtotal([{ unitPrice: 5000, quantity: 2 }, { unitPrice: 3000, quantity: 1 }])).toBe(13000);
  });

  it("rejects invalid quantities and prices", () => {
    expect(() => calculateSubtotal([{ unitPrice: 1000, quantity: 0 }])).toThrow(RangeError);
    expect(() => calculateSubtotal([{ unitPrice: -1, quantity: 1 }])).toThrow(RangeError);
  });

  it("applies a valid discount and rejects excessive discounts", () => {
    expect(calculateTotal(10000, 1500)).toBe(8500);
    expect(() => calculateTotal(10000, 10001)).toThrow(RangeError);
  });
});
