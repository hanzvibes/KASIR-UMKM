import { describe, expect, it } from "vitest";
import { buildQuickCashOptions, calculateChange, parseDiscountInput } from "./pos";

describe("parseDiscountInput", () => {
  it("treats an empty or blank field as no discount", () => {
    expect(parseDiscountInput("", 50_000)).toEqual({ amount: 0, error: null });
    expect(parseDiscountInput("   ", 50_000)).toEqual({ amount: 0, error: null });
    expect(parseDiscountInput("0", 50_000)).toEqual({ amount: 0, error: null });
  });

  it("accepts whole rupiah up to the subtotal", () => {
    expect(parseDiscountInput("5000", 50_000)).toEqual({ amount: 5_000, error: null });
    expect(parseDiscountInput("05000", 50_000)).toEqual({ amount: 5_000, error: null });
    expect(parseDiscountInput("50000", 50_000)).toEqual({ amount: 50_000, error: null });
  });

  it("rejects amounts above the subtotal so the total cannot be misread", () => {
    expect(parseDiscountInput("50001", 50_000)).toEqual({ amount: 50_001, error: "over_subtotal" });
  });

  it("rejects text, decimals, and negatives", () => {
    expect(parseDiscountInput("abc", 50_000).error).toBe("invalid");
    expect(parseDiscountInput("5000.5", 50_000).error).toBe("invalid");
    expect(parseDiscountInput("-5000", 50_000).error).toBe("invalid");
    expect(parseDiscountInput("5.000", 50_000).error).toBe("invalid");
  });
});

describe("buildQuickCashOptions", () => {
  it("always starts with the exact amount", () => {
    expect(buildQuickCashOptions(55_000)[0]).toBe(55_000);
    expect(buildQuickCashOptions(37_500)).toContain(37_500);
  });

  it("offers only amounts that cover the bill, sorted and deduplicated", () => {
    const options = buildQuickCashOptions(55_000);
    expect(options).toEqual([55_000, 60_000, 100_000]);
    expect(options.every((amount) => amount >= 55_000)).toBe(true);
  });

  it("keeps the exact amount available for a discounted bill", () => {
    // Subtotal 50.000 with a 10.000 discount: the old subtotal-based filter
    // dropped the "uang pas" option entirely.
    expect(buildQuickCashOptions(40_000)).toContain(40_000);
    expect(buildQuickCashOptions(40_000)).toEqual([40_000, 50_000, 100_000]);
  });

  it("returns no options for a zero bill or invalid input", () => {
    expect(buildQuickCashOptions(0)).toEqual([]);
    expect(buildQuickCashOptions(-1)).toEqual([]);
    expect(buildQuickCashOptions(Number.NaN)).toEqual([]);
  });
});

describe("calculateChange", () => {
  it("returns the difference when cash covers the bill", () => {
    expect(calculateChange(50_000, 32_500)).toBe(17_500);
    expect(calculateChange(32_500, 32_500)).toBe(0);
  });

  it("returns null when cash is missing or short", () => {
    expect(calculateChange(null, 32_500)).toBeNull();
    expect(calculateChange(30_000, 32_500)).toBeNull();
    expect(calculateChange(Number.NaN, 32_500)).toBeNull();
    expect(calculateChange(50_000, Number.NaN)).toBeNull();
  });
});
