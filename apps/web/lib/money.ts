import { fromAud, type Currency, type TripBrief } from "@trip/shared";

import { intlLocale, type AppLocale, type MessageKey } from "./i18n/locale";

/**
 * Every amount the web app shows. Planning amounts are AUD numbers and convert to the display
 * currency with the shared rate table; fares are a provider's own-currency price and never convert.
 * Nothing here feeds back into planning, and the sentence sent to the planner is not a display
 * amount.
 */
export type Money = {
  /** A planning amount in the display currency; a source budget in that currency shows as stated. */
  money(aud: number, source?: SourceBudget): string;
  /** A provider's price in its own currency: `JPY 230`, `AUD 12.50`, `KRW 14,000`. */
  fare(fare: { amount: number; currency: string }): string;
  /** A signed planning difference: `+AUD 12.00`, `−AUD 30.00`; zero after rounding has no sign. */
  delta(aud: number): string;
  /** Under or over budget, by how much, and the sentence key. Undefined without both figures. */
  budgetGap(
    estimate: number,
    budget: number | undefined,
    source?: SourceBudget,
  ): BudgetGap | undefined;
};

export type SourceBudget = NonNullable<TripBrief["budgetSource"]>;

export type BudgetGap = {
  direction: "under" | "over";
  key: Extract<
    MessageKey,
    "{amount} over the {budget} budget" | "{amount} under the {budget} budget"
  >;
  /** Formatted amounts for the key's `{amount}` (always unsigned) and `{budget}` placeholders. */
  params: { amount: string; budget: string };
};

/**
 * Decimal places shown for a currency, from its ISO 4217 minor unit: `JPY` and `KRW` have none,
 * `AUD` has two. An unknown code keeps two.
 */
export function currencyDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * A provider's price in its own currency, never converted, for code outside React. The number
 * follows the interface language and groups only from five digits, so a four-digit fare stays
 * `KRW 1400`.
 */
export function fare(
  { amount, currency }: { amount: number; currency: string },
  locale: AppLocale,
) {
  const digits = currencyDigits(currency);
  const number = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: Math.abs(amount) >= 10_000,
  }).format(amount);
  return `${currency} ${number}`;
}

/** Typographic minus, so a negative amount never reads as a hyphenated word. */
const MINUS = "−";

/**
 * Formatters for one display currency and interface language. `whole` rounds to whole units, for
 * views that compare amounts on one coarse scale.
 */
export function moneyDisplay({
  currency,
  locale,
  whole = false,
}: {
  currency: Currency;
  locale: AppLocale;
  whole?: boolean;
}): Money {
  const digits = whole ? 0 : currencyDigits(currency);
  const amountFormat = (signDisplay: "auto" | "exceptZero") =>
    new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay,
    });
  const plainFormat = amountFormat("auto");
  const signedFormat = amountFormat("exceptZero");
  // A value that rounds to zero is zero, so neither `-0` nor `-0.004` gains a sign.
  const format = (formatter: Intl.NumberFormat, value: number) =>
    formatter
      .formatToParts(Math.round(value * 10 ** digits) === 0 ? 0 : value)
      .map((part) => (part.type === "minusSign" ? MINUS : part.value))
      .join("");
  const money = (aud: number, source?: SourceBudget) =>
    format(plainFormat, source?.currency === currency ? source.amount : fromAud(aud, currency));
  return {
    money,
    fare: (value) => fare(value, locale),
    delta: (aud) => format(signedFormat, fromAud(aud, currency)),
    budgetGap(estimate, budget, source) {
      if (!Number.isFinite(estimate) || estimate < 0) return undefined;
      if (budget === undefined || !Number.isFinite(budget) || budget <= 0) return undefined;
      const over = estimate > budget;
      return {
        direction: over ? "over" : "under",
        key: over ? "{amount} over the {budget} budget" : "{amount} under the {budget} budget",
        params: { amount: money(Math.abs(budget - estimate)), budget: money(budget, source) },
      };
    },
  };
}
