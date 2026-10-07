import { describe, it, expect } from "vitest";
import {
  AUD_PER,
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  detectCurrency,
  formatMoney,
  moneyIn,
  toAud,
} from "../src/money";
import { TripBrief } from "../src/contracts";
import { PartialTripBrief } from "../src/chat";

describe("toAud", () => {
  it("converts the currencies a traveller can state a budget in", () => {
    // Derived from the table on purpose. Pinning the products here would mean a
    // rate review shows up as a test failure, which trains people to edit the
    // number until it goes green instead of reading what changed.
    for (const [amount, currency] of [
      [3000, "CNY"],
      [3000, "USD"],
      [50000, "JPY"],
    ] as const)
      expect(toAud(amount, currency)).toBe(Math.round(amount * AUD_PER[currency] * 100) / 100);
  });

  it("converts to a plausible order of magnitude", () => {
    // The guard the derived test above cannot give: an inverted or misplaced
    // decimal would still satisfy its own arithmetic.
    expect(toAud(1000, "CNY")).toBeGreaterThan(50);
    expect(toAud(1000, "CNY")).toBeLessThan(1000);
    expect(toAud(1000, "USD")).toBeGreaterThan(1000);
    expect(toAud(1000, "USD")).toBeLessThan(3000);
    expect(toAud(100000, "JPY")).toBeGreaterThan(300);
    expect(toAud(100000, "JPY")).toBeLessThan(3000);
  });

  it("leaves a base-currency amount untouched", () => {
    // The form and any already-converted amount come back through here; a second
    // pass must not shrink the budget again.
    expect(toAud(3000, BASE_CURRENCY)).toBe(3000);
    expect(toAud(toAud(3000, "AUD"), "AUD")).toBe(3000);
  });

  it("rounds to cents rather than carrying float dust", () => {
    // Compare against its own rounding: `69.93 * 100` is 6992.999… in float, so
    // multiplying out to test for whole cents fails on correct values.
    const whole = (value: number) => Math.round(value * 100) / 100 === value;
    expect(whole(toAud(333, "CNY"))).toBe(true);
    expect(whole(toAud(7, "JPY"))).toBe(true);
    expect(whole(toAud(12345, "USD"))).toBe(true);
  });

  it("refuses amounts that cannot be a budget", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => toAud(bad, "AUD")).toThrow(/positive, finite/);
  });

  it("refuses an amount that rounds away to nothing", () => {
    // TripBrief requires at least 0.01, so returning 0 here would fail later
    // with an error that says nothing about the conversion.
    expect(() => toAud(0.0001, "JPY")).toThrow(/too small/);
  });

  it("has a rate for every supported currency, with the base at 1", () => {
    for (const currency of SUPPORTED_CURRENCIES) expect(AUD_PER[currency]).toBeGreaterThan(0);
    expect(AUD_PER[BASE_CURRENCY]).toBe(1);
  });
});

describe("detectCurrency", () => {
  it.each([
    ["3000rmb", "CNY"],
    ["预算 3000 人民币", "CNY"],
    ["¥3000", "CNY"],
    ["3000元", "CNY"],
    ["50000 円", "JPY"],
    ["50000 JPY", "JPY"],
    ["50000 日元", "JPY"],
    ["3000 美元", "USD"],
    ["3000 美金", "USD"],
    ["US$3000", "USD"],
    ["3000 AUD", "AUD"],
    ["A$3000", "AUD"],
    ["3000 澳元", "AUD"],
  ] as const)("reads %s as %s", (text, expected) => {
    expect(detectCurrency(text)).toBe(expected);
  });

  it("does not read the 元 inside 美元 / 日元 / 澳元 as CNY", () => {
    // Same shape of bug as 人民币 matching a `人` traveller-count pattern: a
    // shorter marker swallowing a longer one that contains it.
    for (const [text, expected] of [
      ["3000 美元", "USD"],
      ["50000 日元", "JPY"],
      ["3000 澳元", "AUD"],
    ] as const)
      expect(detectCurrency(text)).toBe(expected);
  });

  it("reports nothing for an unmarked amount, which is already the base currency", () => {
    expect(detectCurrency("3000")).toBeUndefined();
    expect(detectCurrency("budget 3000")).toBeUndefined();
  });

  it("treats a bare dollar sign as unmarked rather than guessing USD", () => {
    // $ is ambiguous between USD and AUD. With AUD as the base, saying nothing
    // is the same as saying AUD, so there is nothing to guess.
    expect(detectCurrency("$3000")).toBeUndefined();
  });

  it("does not read 人民币 as a traveller count", () => {
    // The offline parser matches `(\d+)\s*人` for group size; the budget marker
    // has to be recognised so that 人民币 is consumed as money first.
    expect(detectCurrency("10.6-10.9，预算 3000 人民币")).toBe("CNY");
  });
});

describe("budgetSource on a brief", () => {
  const base = {
    tripId: "t1",
    destination: "Sydney",
    dates: ["2026-10-06", "2026-10-09"],
    groupSize: 2,
    budgetTotal: 630,
  };

  it("parses a brief saved before the field existed", () => {
    // This is why the field is optional rather than required-plus-a-version-bump:
    // every trip already in a browser keeps loading.
    const parsed = TripBrief.parse(base);
    expect(parsed.budgetSource).toBeUndefined();
    expect(PartialTripBrief.parse({ budgetTotal: 630 }).budgetSource).toBeUndefined();
  });

  it("keeps what the traveller said alongside the converted total", () => {
    const parsed = TripBrief.parse({ ...base, budgetSource: { amount: 3000, currency: "CNY" } });
    expect(parsed.budgetSource).toEqual({ amount: 3000, currency: "CNY" });
    expect(parsed.budgetTotal).toBe(toAud(3000, "CNY"));
  });

  it("rejects a currency this product does not support", () => {
    expect(() =>
      TripBrief.parse({ ...base, budgetSource: { amount: 3000, currency: "GBP" } }),
    ).toThrow();
  });
});

describe("moneyIn", () => {
  it("drops the minor unit for a currency that has none", () => {
    expect(moneyIn(3000, "JPY")).not.toMatch(/\./);
  });

  it("keeps cents for currencies that have them", () => {
    expect(moneyIn(3000, "CNY")).toMatch(/3,000\.00/);
    expect(moneyIn(3000, "USD")).toMatch(/3,000\.00/);
  });
});

// Failure inventory for formatMoney, written before the code:
// - an AUD amount no longer reads exactly as the inline `AUD ${n.toFixed(2)}` it replaces (trace text drifts);
// - the whole-dollar and as-typed styles (`AUD 4,000`, `AUD 4000`) lose their exact shape;
// - a non-AUD currency shows the AUD number under another code (conversion skipped or inverted);
// - JPY shows decimals, or rounds in the wrong direction;
// - negative, zero or fractional amounts lose sign or precision;
// - a non-finite amount is printed as "AUD NaN" instead of failing loudly.
describe("formatMoney", () => {
  it("writes AUD exactly as the specialists' inline strings did", () => {
    expect(formatMoney(12.5, "AUD")).toBe("AUD 12.50");
    expect(formatMoney(1400, "AUD")).toBe("AUD 1400.00");
    expect(formatMoney(0, "AUD")).toBe("AUD 0.00");
    expect(formatMoney(1234.567, "AUD")).toBe("AUD 1234.57");
  });

  it("keeps the whole-dollar and as-typed styles", () => {
    expect(formatMoney(4000, "AUD", "whole")).toBe("AUD 4,000");
    expect(formatMoney(1582.4, "AUD", "whole")).toBe("AUD 1,582");
    expect(formatMoney(4000, "AUD", "plain")).toBe("AUD 4000");
    expect(formatMoney(4000.5, "AUD", "plain")).toBe("AUD 4000.5");
  });

  it("converts through the static rate table for other currencies", () => {
    // AUD 30 at 1.5 AUD per USD is USD 20; at 0.21 AUD per CNY it is CNY 142.86.
    expect(formatMoney(30, "USD")).toBe("USD 20.00");
    expect(formatMoney(30, "CNY")).toBe("CNY 142.86");
  });

  it("shows JPY without decimals", () => {
    expect(formatMoney(12.5, "JPY")).toBe("JPY 1250");
    expect(formatMoney(12.504, "JPY", "whole")).toBe("JPY 1,250");
    expect(formatMoney(0.004, "JPY")).toBe("JPY 0");
  });

  it("keeps the sign of a signed difference", () => {
    expect(formatMoney(-30, "AUD")).toBe("AUD -30.00");
    expect(formatMoney(-30, "USD")).toBe("USD -20.00");
  });

  it("refuses a non-finite amount", () => {
    expect(() => formatMoney(Number.NaN, "AUD")).toThrow();
    expect(() => formatMoney(Number.POSITIVE_INFINITY, "USD")).toThrow();
  });
});
