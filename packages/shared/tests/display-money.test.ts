import { describe, expect, it } from "vitest";
import { fromAud, toAud } from "../src/money";

describe("AUD display conversion", () => {
  it("converts a known AUD budget to each supported currency", () => {
    expect(fromAud(1050, "CNY")).toBe(5000);
    expect(fromAud(1500, "USD")).toBe(1000);
    expect(fromAud(500, "JPY")).toBe(50000);
    expect(fromAud(12.34, "AUD")).toBe(12.34);
  });
  it("round trips stated budgets within one AUD cent", () => {
    for (const currency of ["AUD", "CNY", "USD", "JPY"] as const)
      expect(Math.abs(toAud(fromAud(1050.01, currency), currency) - 1050.01)).toBeLessThanOrEqual(
        0.01,
      );
  });
  it("allows free items and signed budget differences but rejects non-finite values", () => {
    expect(fromAud(0, "CNY")).toBe(0);
    expect(fromAud(-1050, "CNY")).toBe(-5000);
    for (const amount of [NaN, Infinity, -Infinity]) expect(() => fromAud(amount, "USD")).toThrow();
  });
});
