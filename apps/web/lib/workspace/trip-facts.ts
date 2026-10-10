import {
  type Currency,
  MAX_TRIP_PREFERENCE_LENGTH,
  MAX_TRIP_PREFERENCES,
  type TripBrief,
} from "@trip/shared";
import { parseDraft, statedBudgetSource, type Draft } from "./workspace";
import { intlLocale, translate, type AppLocale } from "../i18n/locale";
import { moneyDisplay } from "../money";
import type { Notice } from "../i18n/notice";

export const PARTY_ROWS = [
  { key: "adults", label: "Adults", hint: "Ages 13–64", singular: "adult", article: "an" },
  { key: "children", label: "Children", hint: "Ages 2–12", singular: "child", article: "a" },
  { key: "infants", label: "Infants", hint: "Under 2", singular: "infant", article: "an" },
  { key: "seniors", label: "Seniors", hint: "65+", singular: "senior", article: "a" },
  { key: "pets", label: "Pets", hint: "", singular: "pet", article: "a" },
] as const;

export const FACTS = ["where", "when", "who", "budget", "preferences"] as const;
export type FactKey = (typeof FACTS)[number];

export const FACT_FIELDS: Record<FactKey, readonly (keyof Draft)[]> = {
  where: ["destination", "origin"],
  when: ["start", "end"],
  who: ["groupSize"],
  budget: ["budgetTotal"],
  preferences: ["preferences"],
};

export const RETIRED_FIELDS: readonly (keyof Draft)[] = [
  "nationality",
  "roomAllocation",
  "minRating",
  "freeCancellation",
];

const FACT_ERRORS: Record<FactKey, readonly string[]> = {
  where: ["destination", "origin"],
  when: ["dates"],
  who: ["groupSize"],
  budget: ["budgetTotal"],
  preferences: ["preferences"],
};

export function factForError(key: string): FactKey {
  return FACTS.find((fact) => FACT_ERRORS[fact].includes(key)) ?? "preferences";
}

export function firstFactWithError(errors: Record<string, Notice>): FactKey | undefined {
  const keys = Object.keys(errors);
  return FACTS.find((fact) => keys.some((key) => factForError(key) === fact));
}

export function firstMissingFact(draft: Draft): FactKey | undefined {
  if (!draft.destination.trim()) return "where";
  if (!draft.start || !draft.end) return "when";
  if (!draft.groupSize.trim()) return "who";
  if (!draft.budgetTotal.trim()) return "budget";
  return undefined;
}

export function factErrors(
  fact: FactKey,
  draft: Draft,
  current: Pick<TripBrief, "tripId"> & Partial<TripBrief>,
  requireAll: boolean,
): Record<string, Notice> {
  if (!requireAll && FACT_FIELDS[fact].every((field) => isBlank(draft[field]))) return {};
  if (fact === "when" && !requireAll && (!draft.start || !draft.end))
    return { dates: { key: "Choose both a start and an end date." } };

  const checked =
    fact === "when" && !draft.destination.trim() ? { ...draft, destination: "?" } : draft;
  const parsed = parseDraft(checked, current);
  if (parsed.success) return {};
  const errors: Record<string, Notice> = {};
  for (const [key, message] of Object.entries(briefErrors(parsed.error.issues)))
    if (FACT_ERRORS[fact].includes(key)) errors[key] = message;
  return errors;
}

const isBlank = (value: Draft[keyof Draft]) =>
  Array.isArray(value) ? value.length === 0 : String(value ?? "").trim() === "";

const FIX: Record<string, Notice> = {
  destination: { key: "Enter a destination." },
  origin: { key: "Enter where you are departing from, or leave it blank." },
  groupSize: { key: "Enter a whole number of travellers, 1 or more." },
  budgetTotal: { key: "Enter a total budget above zero." },
  preferences: {
    key: "Keep to {count} preferences of up to {length} characters each.",
    params: { count: MAX_TRIP_PREFERENCES, length: MAX_TRIP_PREFERENCE_LENGTH },
  },
};

const CHECK_DETAILS: Notice = { key: "Check the highlighted trip details." };
const DATES_ORDER = "End date must follow start date, with at least one night per destination.";

const datesFix = (message: string): Notice =>
  message === DATES_ORDER ? { key: DATES_ORDER } : { key: "Choose both a start and an end date." };

export function briefErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, Notice> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    errors[key] ??= key === "dates" ? datesFix(issue.message) : (FIX[key] ?? CHECK_DETAILS);
  }
  return errors;
}

const shortDate = (iso: string, withYear: boolean, locale: AppLocale) =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

const validDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso));

export function datesLabel(start: string, end: string, locale: AppLocale = "en") {
  if (!validDate(start) || !validDate(end)) return undefined;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1) return undefined;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const range = `${shortDate(start, !sameYear, locale)} – ${shortDate(end, !sameYear, locale)}`;
  return {
    range,
    days: locale === "zh" ? `${days} 天` : `${days} ${days === 1 ? "day" : "days"}`,
  };
}

export function factLabels(
  draft: Draft,
  brief?: TripBrief,
  display: { locale?: AppLocale; currency?: Currency } = {},
) {
  const locale = display.locale ?? "en";
  const travellers = Number(draft.groupSize);
  const budget = Number(draft.budgetTotal);
  const dates = datesLabel(draft.start, draft.end, locale);
  const currency = display.currency ?? "AUD";
  const validTravellers = draft.groupSize.trim() && Number.isInteger(travellers) && travellers > 0;
  return {
    where: draft.destination.trim() || undefined,
    when: dates && `${dates.range} · ${dates.days}`,
    who: validTravellers ? whoLabel(draft, travellers, locale) : undefined,
    budget:
      draft.budgetTotal.trim() && Number.isFinite(budget) && budget > 0
        ? moneyDisplay({ currency, locale }).money(budget, statedBudgetSource(draft))
        : undefined,
  };
}

function whoLabel(draft: Draft, travellers: number, locale: AppLocale) {
  const plain =
    locale === "zh"
      ? `${travellers} 位旅行人员`
      : `${travellers} ${travellers === 1 ? "traveller" : "travellers"}`;
  const party = draft.party;
  if (!party) return plain;
  const parts = PARTY_ROWS.map(({ key, singular, label }) => {
    const count = party[key];
    return count > 0
      ? locale === "zh"
        ? `${count} ${translate(locale, label)}`
        : `${count} ${count === 1 ? singular : `${singular}s`}`
      : undefined;
  }).filter((part): part is string => !!part);
  return parts.length ? parts.join(", ") : plain;
}
