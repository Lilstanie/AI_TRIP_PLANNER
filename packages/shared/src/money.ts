import { z } from "zod";

// ---------------------------------------------------------------------------
// Money. Planning amounts and guardrails stay in AUD. Stated budgets convert
// to AUD once; the workspace converts AUD totals for display through the same
// rate table. Display conversions never feed back into planning.
//
// BASE_CURRENCY is that one currency. Provider-native fares (such as a Google
// transit fare) may still carry their own currency because they are displayed
// as evidence and are not included in the AUD planning totals.
// ---------------------------------------------------------------------------

export const SUPPORTED_CURRENCIES = ["AUD", "CNY", "USD", "JPY"] as const;
export const Currency = z.enum(SUPPORTED_CURRENCIES);
export type Currency = z.infer<typeof Currency>;

export const BASE_CURRENCY: Currency = "AUD";

/**
 * How many BASE_CURRENCY units one unit of each currency is worth.
 *
 * Deliberately static: this product does not call an FX service, and a rate
 * invented by a language model would silently skew every budget guardrail with
 * nothing to catch it. Stating the rates here makes them reviewable.
 *
 * Be clear about what these numbers are. They are round figures at roughly the
 * right level, not quotes: nobody checked them against a market on RATES_AS_OF.
 * They are deliberately given to two significant figures so they do not read as
 * more precise than they are. That is fine for sizing a holiday budget, and not
 * fine for financial transactions. The workspace may also use these figures
 * for approximate display conversion, with a visible notice and RATES_AS_OF.
 *
 * Review them when RATES_AS_OF looks old, or when a budget converts to something
 * a traveller would call wrong. Major currencies can drift 10% in a year.
 */
export const AUD_PER: Record<Currency, number> = {
  AUD: 1,
  CNY: 0.21,
  USD: 1.5,
  JPY: 0.01,
};

/** Without this nobody can tell a stale table from a current one. */
export const RATES_AS_OF = "2026-09-20";

/**
 * Convert to the base currency, rounded to cents.
 *
 * Throws rather than coercing: a budget that silently became 0 or NaN would
 * fail far away from here, inside TripBrief's `min(0.01)` or a budget check.
 */
export function toAud(amount: number, from: Currency): number {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("A budget must be a positive, finite amount.");
  const converted = Math.round(amount * AUD_PER[from] * 100) / 100;
  if (converted <= 0) throw new Error("That amount is too small to convert.");
  return converted;
}

/** Convert an AUD planning amount for display, allowing zero costs and signed differences. */
export function fromAud(amount: number, to: Currency): number {
  if (!Number.isFinite(amount)) throw new Error("A display amount must be finite.");
  return amount / AUD_PER[to];
}

/**
 * Order matters. 美元, 日元 and 澳元 all end in 元, so the qualified names have to
 * be tested before the bare 元 that means CNY — the same trap as 人民币 being
 * read as a traveller count because it contains 人.
 */
const CURRENCY_MARKERS: [RegExp, Currency][] = [
  [/(?:^|[^a-z])(?:rmb|cny)|人民币|￥|¥/i, "CNY"],
  [/(?:^|[^a-z])(?:jpy|yen)|日元|日圓|円/i, "JPY"],
  [/(?:^|[^a-z])(?:usd|us\$)|美元|美金/i, "USD"],
  [/(?:^|[^a-z])(?:aud|au\$|a\$)|澳元|澳币|澳幣/i, "AUD"],
  // Bare 元 is CNY, but only when it is not the tail of one of the above.
  [/(?<![美日澳])元/, "CNY"],
];

/**
 * Best-effort currency marker detection for the offline (no API key) path only.
 * When a model is available it identifies the currency itself; patterns cannot
 * cover the ways people write money, which is the whole reason this is a
 * fallback rather than the main path.
 *
 * Two deliberate calls on ambiguous markers:
 * - bare `¥` / `￥` means CNY. This product's second language is Chinese; JPY
 *   has to be said explicitly (`円`, `JPY`, `yen`).
 * - bare `$` is not a marker at all. It is ambiguous between USD and AUD, and
 *   with AUD as the base an unmarked amount is already treated as AUD.
 */
export function detectCurrency(text: string): Currency | undefined {
  for (const [pattern, currency] of CURRENCY_MARKERS) if (pattern.test(text)) return currency;
  return undefined;
}

/**
 * Format an amount in the currency the traveller actually named, for the "what
 * you told us" hint beside a converted budget. The base-currency formatter for
 * everything else lives in the web app; this one exists because JPY has no
 * minor unit and Intl only knows that from the currency code.
 */
export function moneyIn(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}
