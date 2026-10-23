import { describe, expect, it } from "vitest";
import {
  buildQuickCashOptions,
  calculateChange,
  LOW_STOCK_THRESHOLD,
  parseDiscountInput,
  paymentMethodLabel,
  parseStockAdjustment,
  sanitizeSearchTerm,
  stockState,
} from "./pos";

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

describe("stockState", () => {
  it("ignores products whose stock is not tracked", () => {
    expect(stockState({ track_stock: false, stock_qty: 0 })).toBe("untracked");
    expect(stockState({ track_stock: false, stock_qty: null })).toBe("untracked");
  });

  it("treats a missing tracked stock as sold out", () => {
    expect(stockState({ track_stock: true, stock_qty: null })).toBe("out");
    expect(stockState({ track_stock: true, stock_qty: 0 })).toBe("out");
  });

  it("warns at the threshold and stays quiet above it", () => {
    expect(stockState({ track_stock: true, stock_qty: LOW_STOCK_THRESHOLD })).toBe("low");
    expect(stockState({ track_stock: true, stock_qty: 0.5 })).toBe("low");
    expect(stockState({ track_stock: true, stock_qty: LOW_STOCK_THRESHOLD + 1 })).toBe("ok");
    expect(stockState({ track_stock: true, stock_qty: "12.5" })).toBe("ok");
  });
});

describe("paymentMethodLabel", () => {
  it("labels every supported and legacy payment method", () => {
    expect(paymentMethodLabel("cash")).toBe("Tunai");
    expect(paymentMethodLabel("qris")).toBe("QRIS");
    expect(paymentMethodLabel("transfer")).toBe("Transfer");
    expect(paymentMethodLabel("other")).toBe("Lainnya");
    expect(paymentMethodLabel("unknown")).toBe("Metode lain");
  });
});

describe("parseStockAdjustment", () => {
  it("accepts positive whole and decimal quantities", () => {
    expect(parseStockAdjustment("12")).toEqual({ amount: 12, error: null });
    expect(parseStockAdjustment("2.5")).toEqual({ amount: 2.5, error: null });
    expect(parseStockAdjustment(" 0.001 ")).toEqual({ amount: 0.001, error: null });
  });

  it("rejects zero, negatives, text, and more than three decimals", () => {
    expect(parseStockAdjustment("0").error).toBe("invalid");
    expect(parseStockAdjustment("-3").error).toBe("invalid");
    expect(parseStockAdjustment("abc").error).toBe("invalid");
    expect(parseStockAdjustment("1.2345").error).toBe("invalid");
    expect(parseStockAdjustment("1000001").error).toBe("invalid");
    expect(parseStockAdjustment("").error).toBe("invalid");
  });
});

describe("sanitizeSearchTerm", () => {
  it("keeps letters, numbers, spaces, and SKU punctuation", () => {
    expect(sanitizeSearchTerm("Kopi Susu 001")).toBe("Kopi Susu 001");
    expect(sanitizeSearchTerm("KOP_001-A.2")).toBe("KOP_001-A.2");
  });

  it("removes PostgREST filter characters", () => {
    expect(sanitizeSearchTerm("a,b(c)d%e*f")).toBe("abcdef");
  });

  it("trims and caps the query length", () => {
    expect(sanitizeSearchTerm("  kopi  ")).toBe("kopi");
    expect(sanitizeSearchTerm("a".repeat(100), 12)).toHaveLength(12);
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
