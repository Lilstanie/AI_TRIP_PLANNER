import { fromAud, type Currency, type TripBrief } from "@trip/shared";

import { intlLocale, type AppLocale, type MessageKey } from "./i18n/locale";

export type Money = {
  money(aud: number, source?: SourceBudget): string;

  fare(fare: { amount: number; currency: string }): string;

  delta(aud: number): string;

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

  params: { amount: string; budget: string };
};

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

export function fare(
  { amount, currency }: { amount: number; currency: string },
  locale: AppLocale,
) {
  const digits = currencyDigits(currency);
  const number = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(amount);
  return `${currency} ${number}`;
}

const MINUS = "−";

export function plannerAud(aud: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    currencyDisplay: "code",
  }).format(aud);
}

const currencySymbol = (currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "symbol" })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value ?? currency;

export function moneyDisplay({
  currency,
  locale,
  whole = false,
  symbol = false,
}: {
  currency: Currency;
  locale: AppLocale;
  whole?: boolean;
  symbol?: boolean;
}): Money {
  const digits = whole ? 0 : currencyDigits(currency);
  const sign = symbol ? currencySymbol(currency) : undefined;
  const amountFormat = (signDisplay: "auto" | "exceptZero") =>
    new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      currencyDisplay: symbol ? "symbol" : "code",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay,
    });
  const plainFormat = amountFormat("auto");
  const signedFormat = amountFormat("exceptZero");

  const format = (formatter: Intl.NumberFormat, value: number) =>
    formatter
      .formatToParts(Math.round(value * 10 ** digits) === 0 ? 0 : value)
      .filter((part) => !(sign && part.type === "literal" && !part.value.trim()))
      .map((part) =>
        part.type === "minusSign" ? MINUS : sign && part.type === "currency" ? sign : part.value,
      )
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
