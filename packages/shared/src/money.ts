import { z } from "zod";

export const SUPPORTED_CURRENCIES = ["AUD", "CNY", "USD", "JPY"] as const;
export const Currency = z.enum(SUPPORTED_CURRENCIES);
export type Currency = z.infer<typeof Currency>;

export const BASE_CURRENCY: Currency = "AUD";

export const AUD_PER: Record<Currency, number> = {
  AUD: 1,
  CNY: 0.21,
  USD: 1.5,
  JPY: 0.01,
};

export const RATES_AS_OF = "2026-09-20";

export function toAud(amount: number, from: Currency): number {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("A budget must be a positive, finite amount.");
  const converted = Math.round(amount * AUD_PER[from] * 100) / 100;
  if (converted <= 0) throw new Error("That amount is too small to convert.");
  return converted;
}

export function fromAud(amount: number, to: Currency): number {
  if (!Number.isFinite(amount)) throw new Error("A display amount must be finite.");
  return amount / AUD_PER[to];
}

export function effectiveCurrency(
  brief: { displayCurrency?: Currency; budgetSource?: { currency: Currency } } | undefined,
  fallback: Currency,
): Currency {
  return brief?.displayCurrency ?? brief?.budgetSource?.currency ?? fallback;
}

const CURRENCY_MARKERS: [RegExp, Currency][] = [
  [/(?:^|[^a-z])(?:rmb|cny)|人民币|￥|¥/i, "CNY"],
  [/(?:^|[^a-z])(?:jpy|yen)|日元|日圓|円/i, "JPY"],
  [/(?:^|[^a-z])(?:usd|us\$)|美元|美金/i, "USD"],
  [/(?:^|[^a-z])(?:aud|au\$|a\$)|澳元|澳币|澳幣/i, "AUD"],

  [/(?<![美日澳])元/, "CNY"],
];

export function detectCurrency(text: string): Currency | undefined {
  for (const [pattern, currency] of CURRENCY_MARKERS) if (pattern.test(text)) return currency;
  return undefined;
}

export function moneyIn(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

const MINOR_DIGITS: Record<Currency, number> = { AUD: 2, CNY: 2, USD: 2, JPY: 0 };

export type MoneyStyle = "cents" | "whole" | "plain";

export function formatMoney(
  amountAud: number,
  currency: Currency,
  style: MoneyStyle = "cents",
): string {
  if (!Number.isFinite(amountAud)) throw new Error("A display amount must be finite.");
  if (currency === BASE_CURRENCY && style === "plain") return `${currency} ${amountAud}`;
  const value = currency === BASE_CURRENCY ? amountAud : fromAud(amountAud, currency);
  if (style === "whole")
    return `${currency} ${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  const digits = MINOR_DIGITS[currency];

  if (currency === BASE_CURRENCY) return `${currency} ${value.toFixed(digits)}`;
  return `${currency} ${value.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function estimateNote(currency: Currency): string {
  return currency === BASE_CURRENCY
    ? ""
    : `Amounts in ${currency} are approximate conversions at fixed rates (as of ${RATES_AS_OF}), not live quotes.`;
}
