import { BASE_CURRENCY, RATES_AS_OF, estimateNote, formatMoney, fromAud } from "@trip/shared";
import type { Currency, InterfaceLanguage, TripPlan } from "@trip/shared";
import { isInfeasible, minimumCost } from "./conflicts";

const CATEGORIES = [
  { id: "accommodation", en: "accommodation", zh: "住宿" },
  { id: "transport", en: "transport", zh: "交通" },
  { id: "dining", en: "meals", zh: "餐饮" },
  { id: "itinerary", en: "activities", zh: "活动" },
] as const;

export function budgetText(plan: TripPlan, currency: Currency): string {
  const source = plan.brief.budgetSource;
  if (source?.currency === currency && currency !== "AUD") {
    const digits = currency === "JPY" ? 0 : 2;
    return `${currency} ${source.amount.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }
  return formatMoney(plan.budgetTotal, currency);
}

export function wholeUp(amountAud: number, currency: Currency): string {
  if (currency === "AUD") return formatMoney(Math.ceil(amountAud), "AUD", "whole");

  const value = Math.ceil(Math.round(fromAud(amountAud, currency) * 100) / 100);
  return `${currency} ${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

export function unpricedStopCount(plan: TripPlan): number {
  const picks = new Set(
    (plan.sections.find((section) => section.id === "dining")?.proposal?.items ?? [])
      .filter((item) => item.kind === "meal" && item.id)
      .map((item) => item.id),
  );
  return (
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? []
  ).filter(
    (item) =>
      item.kind === "activity" && item.estCost === undefined && !(item.id && picks.has(item.id)),
  ).length;
}

export function costLine(plan: TripPlan, currency: Currency, language: InterfaceLanguage): string {
  const zh = language === "zh";
  const money = (amount: number) => formatMoney(amount, currency);
  const sections = (id: string) => plan.sections.filter((section) => section.id === id);
  const included = CATEGORIES.filter(({ id }) =>
    sections(id).some((section) => section.estCost > 0),
  ).map((category) => category[language]);
  const transportItems = sections("transport").flatMap((section) => section.proposal?.items ?? []);
  const transportMissing =
    !transportItems.some((item) => item.estCost !== undefined) ||
    transportItems.some((item) => item.estCost === undefined);
  const stops = unpricedStopCount(plan);
  const excluded = [
    ...(transportMissing ? [zh ? "未定价的交通" : "transport without a price"] : []),
    ...(stops
      ? [
          zh
            ? `${stops} 个未公布价格的停靠点`
            : `${stops} ${stops === 1 ? "stop" : "stops"} without a published price`,
        ]
      : []),
  ];
  const total = money(plan.estTotal);
  const parts = [
    zh
      ? `预计总额：${total}${included.length ? `，包含${included.join("、")}` : ""}。`
      : `Estimated total: ${total}${included.length ? `, covering ${included.join(", ")}` : ""}.`,
    excluded.length
      ? zh
        ? `未计入：${excluded.join("、")}。`
        : `Not included: ${excluded.join(" and ")}.`
      : "",
  ];
  if (plan.budgetTotal > 0) {
    const budget = budgetText(plan, currency);
    const gap = money(Math.abs(plan.budgetTotal - plan.estTotal));
    parts.push(
      plan.estTotal === plan.budgetTotal
        ? zh
          ? `已知估算恰好达到 ${budget} 的预算。`
          : `That equals your ${budget} budget.`
        : plan.estTotal > plan.budgetTotal
          ? zh
            ? `超出预算 ${gap}（预算 ${budget}）。`
            : `That is ${gap} over your ${budget} budget.`
          : zh
            ? `剩余预算 ${gap}（预算 ${budget}）。`
            : `That is ${gap} under your ${budget} budget.`,
    );
  }
  if (plan.conflicts?.some(isInfeasible)) {
    const floor = wholeUp(
      minimumCost(plan.sections.flatMap((section) => section.proposal ?? [])),
      currency,
    );
    parts.push(
      zh
        ? `仅交通和住宿就至少需要 ${floor}，请把预算提高到至少 ${floor}（不含活动和餐饮），或更改日期、出发地或目的地。`
        : `Travel and stays alone need at least ${floor}, so raise the budget to at least ${floor} before activities and meals, or change the dates, origin or destination.`,
    );
  }
  const note =
    zh && currency !== BASE_CURRENCY
      ? `${currency} 金额按固定汇率（截至 ${RATES_AS_OF}）换算，并非实时报价。`
      : estimateNote(currency);
  return [...parts, note].filter(Boolean).join(zh ? "" : " ");
}
