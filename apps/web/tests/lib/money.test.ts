// Failure inventory, written before the module:
// - a JPY or KRW fare gains decimals, or an AUD fare loses its cents (#190);
// - a fare is converted into the display currency, or grouped differently by language;
// - a four-digit fare is left ungrouped (`KRW 1400`) where the spec asks for `KRW 1,400`;
// - a planning amount converts in the wrong direction, or JPY shows decimals;
// - a zero, negative zero or rounds-to-zero difference shows a sign, or a negative one a hyphen;
// - a source budget in another currency is shown verbatim under the wrong code;
// - a budget gap words "over" and "under" differently, uses a negative amount, or reports a gap
//   when the budget or estimate is missing;
// - either interface language formats the same amount differently.
// - Agent Lab (#203) loses its `A$3,960` look: a code instead of the symbol, cents, a sign after
//   the symbol, or a different symbol in Chinese;
// - the planner sentence follows the interface language or the display currency, or drops the
//   cents the planner has always been sent.
import { describe, expect, it } from "vitest";
import { moneyDisplay, plannerAud } from "@/lib/money";
import { translate } from "@/lib/i18n/locale";

// Intl separates the code from the number with a no-break space; compare on plain spaces.
const plain = (text: string) => text.replace(/ /g, " ");
const aud = moneyDisplay({ currency: "AUD", locale: "en" });

describe("fare: a provider's price in its own currency", () => {
  it.each([
    [{ amount: 230, currency: "JPY" }, "JPY 230"],
    [{ amount: 1400, currency: "KRW" }, "KRW 1,400"],
    [{ amount: 999, currency: "KRW" }, "KRW 999"],
    [{ amount: 14000, currency: "KRW" }, "KRW 14,000"],
    [{ amount: 12.5, currency: "AUD" }, "AUD 12.50"],
    [{ amount: 3, currency: "USD" }, "USD 3.00"],
  ])("shows %o with its currency's minor unit as %s", (fare, expected) => {
    expect(aud.fare(fare)).toBe(expected);
  });

  it("is never converted into the display currency", () => {
    const jpy = moneyDisplay({ currency: "JPY", locale: "en" });
    expect(jpy.fare({ amount: 12.5, currency: "AUD" })).toBe("AUD 12.50");
  });

  it("keeps two decimals for a code Intl does not know", () => {
    expect(aud.fare({ amount: 4, currency: "??" })).toBe("?? 4.00");
  });

  it("reads the same in Chinese", () => {
    const zh = moneyDisplay({ currency: "AUD", locale: "zh" });
    expect(zh.fare({ amount: 230, currency: "JPY" })).toBe("JPY 230");
    expect(zh.fare({ amount: 14000, currency: "KRW" })).toBe("KRW 14,000");
  });
});

describe("money: a planning amount in the display currency", () => {
  it.each([
    ["AUD", "AUD 100.00"],
    ["CNY", "CNY 476.19"],
    ["USD", "USD 66.67"],
    ["JPY", "JPY 10,000"],
  ] as const)("converts AUD 100 to %s as %s", (currency, expected) => {
    expect(plain(moneyDisplay({ currency, locale: "en" }).money(100))).toBe(expected);
    expect(plain(moneyDisplay({ currency, locale: "zh" }).money(100))).toBe(expected);
  });

  it("never shows a sign on zero", () => {
    expect(plain(aud.money(-0))).toBe("AUD 0.00");
    expect(plain(moneyDisplay({ currency: "JPY", locale: "en" }).money(-0.004))).toBe("JPY 0");
  });

  it("shows a source budget as stated only when it is in the display currency", () => {
    const source = { amount: 4999, currency: "CNY" } as const;
    expect(plain(moneyDisplay({ currency: "CNY", locale: "en" }).money(1050, source))).toBe(
      "CNY 4,999.00",
    );
    expect(plain(moneyDisplay({ currency: "USD", locale: "en" }).money(1050, source))).toBe(
      "USD 700.00",
    );
  });

  it("rounds to whole units when asked", () => {
    const whole = moneyDisplay({ currency: "AUD", locale: "en", whole: true });
    expect(plain(whole.money(1234.56))).toBe("AUD 1,235");
  });
});

describe("delta: a signed difference", () => {
  it.each([
    [12, "+AUD 12.00"],
    [-30, "−AUD 30.00"],
    [0, "AUD 0.00"],
    [-0, "AUD 0.00"],
    [0.004, "AUD 0.00"],
    [-0.004, "AUD 0.00"],
  ])("shows %s as %s", (amount, expected) => {
    expect(plain(aud.delta(amount))).toBe(expected);
  });

  it("converts before signing", () => {
    const jpy = moneyDisplay({ currency: "JPY", locale: "zh" });
    expect(plain(jpy.delta(-30))).toBe("−JPY 3,000");
    expect(plain(jpy.delta(0.004))).toBe("JPY 0");
  });
});

describe("budgetGap: under or over budget", () => {
  it("reports an overrun as a positive amount over the budget", () => {
    const gap = aud.budgetGap(250, 200)!;
    expect(gap.direction).toBe("over");
    expect(plain(translate("en", gap.key, gap.params))).toBe(
      "AUD 50.00 over the AUD 200.00 budget",
    );
  });

  it("reports room left as under the budget, including an exact match", () => {
    const under = aud.budgetGap(150, 200)!;
    expect(under.direction).toBe("under");
    expect(plain(translate("en", under.key, under.params))).toBe(
      "AUD 50.00 under the AUD 200.00 budget",
    );
    const exact = aud.budgetGap(200, 200)!;
    expect(exact.direction).toBe("under");
    expect(plain(exact.params.amount)).toBe("AUD 0.00");
  });

  it("reads in Chinese with the same amounts", () => {
    const zh = moneyDisplay({ currency: "AUD", locale: "zh" });
    const gap = zh.budgetGap(250, 200)!;
    expect(plain(translate("zh", gap.key, gap.params))).toBe(
      "超出预算 AUD 50.00（预算 AUD 200.00）",
    );
  });

  it("shows the source budget as stated", () => {
    const cny = moneyDisplay({ currency: "CNY", locale: "en" });
    const gap = cny.budgetGap(1260, 1050, { amount: 4999, currency: "CNY" })!;
    expect(gap.direction).toBe("over");
    expect(plain(gap.params.amount)).toBe("CNY 1,000.00");
    expect(plain(gap.params.budget)).toBe("CNY 4,999.00");
  });

  it.each([
    [200, undefined],
    [200, 0],
    [200, Number.NaN],
    [Number.NaN, 200],
    [-1, 200],
  ])("has no gap for estimate %s and budget %s", (estimate, budget) => {
    expect(aud.budgetGap(estimate, budget)).toBeUndefined();
  });
});

describe("symbol: Agent Lab's whole Australian dollars", () => {
  const lab = moneyDisplay({ currency: "AUD", locale: "en", whole: true, symbol: true });

  it.each([
    [3960, "A$3,960"],
    [6000, "A$6,000"],
    [1234.56, "A$1,235"],
    [0.4, "A$0"],
  ])("shows %d as %s", (aud, expected) => {
    expect(lab.money(aud)).toBe(expected);
  });

  it("puts the typographic minus before the symbol", () => {
    expect(lab.money(-30)).toBe("−A$30");
  });

  it("keeps the same symbol in Chinese", () => {
    const zh = moneyDisplay({ currency: "AUD", locale: "zh", whole: true, symbol: true });
    expect(zh.money(3960)).toBe("A$3,960");
  });
});

describe("plannerAud: the amount in the sentence sent to the planner", () => {
  it.each([
    [2000, "AUD 2,000.00"],
    [1234.5, "AUD 1,234.50"],
    [0, "AUD 0.00"],
  ])("writes %d as %s", (aud, expected) => {
    expect(plain(plannerAud(aud))).toBe(expected);
  });
});
