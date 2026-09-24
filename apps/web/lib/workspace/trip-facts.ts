import {
  BASE_CURRENCY,
  MAX_TRIP_PREFERENCE_LENGTH,
  MAX_TRIP_PREFERENCES,
  type TripBrief,
} from "@trip/shared";
import { budgetHint, parseDraft, type Draft } from "./workspace";

/** Age labels shown beside each Who stepper; also the order the chip summary lists them in. */
export const PARTY_ROWS = [
  { key: "adults", label: "Adults", hint: "Ages 13–64", singular: "adult", article: "an" },
  { key: "children", label: "Children", hint: "Ages 2–12", singular: "child", article: "a" },
  { key: "infants", label: "Infants", hint: "Under 2", singular: "infant", article: "an" },
  { key: "seniors", label: "Seniors", hint: "65+", singular: "senior", article: "a" },
  { key: "pets", label: "Pets", hint: "", singular: "pet", article: "a" },
] as const;

/**
 * The top bar edits the brief one fact at a time, each from its own chip. Every draft field
 * belongs to exactly one fact, or is one of the retired fields nothing edits any more.
 */
export const FACTS = ["where", "when", "who", "budget", "preferences"] as const;
export type FactKey = (typeof FACTS)[number];

/** The draft fields each fact edits. */
export const FACT_FIELDS: Record<FactKey, readonly (keyof Draft)[]> = {
  where: ["destination", "origin"],
  when: ["start", "end"],
  who: ["groupSize"],
  budget: ["budgetTotal"],
  preferences: ["preferences"],
};

/**
 * Fields the trip preferences editor used to hold, replaced by the traveller's own preference
 * list. Nothing edits them; a stored brief's values pass through `parseDraft` unchanged.
 */
export const RETIRED_FIELDS: readonly (keyof Draft)[] = [
  "nationality",
  "roomAllocation",
  "minRating",
  "freeCancellation",
];

/** The keys `parseDraft` reports issues under (its path's first segment), by fact. */
const FACT_ERRORS: Record<FactKey, readonly string[]> = {
  where: ["destination", "origin"],
  when: ["dates"],
  who: ["groupSize"],
  budget: ["budgetTotal"],
  preferences: ["preferences"],
};

/** Which fact owns a validation issue, so a rejected submission opens the right editor. */
export function factForError(key: string): FactKey {
  return FACTS.find((fact) => FACT_ERRORS[fact].includes(key)) ?? "preferences";
}

/** The first fact holding one of these errors, in top-bar order. */
export function firstFactWithError(errors: Record<string, string>): FactKey | undefined {
  const keys = Object.keys(errors);
  return FACTS.find((fact) => keys.some((key) => factForError(key) === fact));
}

/** The first of the four trip facts the traveller has not given yet, if any. */
export function firstMissingFact(draft: Draft): FactKey | undefined {
  if (!draft.destination.trim()) return "where";
  if (!draft.start || !draft.end) return "when";
  if (!draft.groupSize.trim()) return "who";
  if (!draft.budgetTotal.trim()) return "budget";
  return undefined;
}

/**
 * Errors in one fact's own fields, checked the way the planner will check them. A blank field is
 * not an error before there is a plan: it is simply not stated yet, and the chat asks for it.
 */
export function factErrors(
  fact: FactKey,
  draft: Draft,
  current: Pick<TripBrief, "tripId"> & Partial<TripBrief>,
  requireAll: boolean,
): Record<string, string> {
  if (!requireAll && FACT_FIELDS[fact].every((field) => isBlank(draft[field]))) return {};
  if (fact === "when" && !requireAll && (!draft.start || !draft.end))
    return { dates: "Choose both a start and an end date." };
  // The dates rule counts a night per destination city. With no destination yet, check the dates
  // against a single city rather than reporting the missing destination as a date error.
  const checked =
    fact === "when" && !draft.destination.trim() ? { ...draft, destination: "?" } : draft;
  const parsed = parseDraft(checked, current);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(briefErrors(parsed.error.issues)))
    if (FACT_ERRORS[fact].includes(key)) errors[key] = message;
  return errors;
}

const isBlank = (value: Draft[keyof Draft]) =>
  Array.isArray(value) ? value.length === 0 : String(value ?? "").trim() === "";

/** Schema messages ("expected number, received NaN") rewritten as how to fix the field. */
const FIX: Record<string, string> = {
  destination: "Enter a destination.",
  origin: "Enter where you are departing from, or leave it blank.",
  groupSize: "Enter a whole number of travellers, 1 or more.",
  budgetTotal: "Enter a total budget above zero.",
  preferences: `Keep to ${MAX_TRIP_PREFERENCES} preferences of up to ${MAX_TRIP_PREFERENCE_LENGTH} characters each.`,
};

/** One message per field, keyed like the old preferences form's errors. */
export function briefErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    errors[key] ??= FIX[key] ?? issue.message;
  }
  return errors;
}

const shortDate = (iso: string, withYear: boolean) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

const validDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso));

/** "1 Oct – 4 Oct" and "4 days"; years only across a new year. Undefined until both dates are real and in order. */
export function datesLabel(start: string, end: string) {
  if (!validDate(start) || !validDate(end)) return undefined;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1) return undefined;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const range = `${shortDate(start, !sameYear)} – ${shortDate(end, !sameYear)}`;
  return { range, days: `${days} ${days === 1 ? "day" : "days"}` };
}

/** Cents only when the amount has them: "AUD 2,000", but "AUD 1,999.50". */
const chipMoney = (amount: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: BASE_CURRENCY,
    currencyDisplay: "code",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);

/**
 * What each chip shows. Only values the traveller stated appear; anything missing reads as an
 * invitation to add it, never as a guess. `brief` is the planned trip's, used only to explain a
 * converted budget that still matches the draft.
 */
export function factLabels(draft: Draft, brief?: TripBrief) {
  const travellers = Number(draft.groupSize);
  const budget = Number(draft.budgetTotal);
  const dates = datesLabel(draft.start, draft.end);
  const hint = brief && budget === brief.budgetTotal ? budgetHint(brief) : "";
  const validTravellers = draft.groupSize.trim() && Number.isInteger(travellers) && travellers > 0;
  return {
    where: draft.destination.trim() || undefined,
    when: dates && `${dates.range} · ${dates.days}`,
    who: validTravellers ? whoLabel(draft, travellers) : undefined,
    budget:
      draft.budgetTotal.trim() && Number.isFinite(budget) && budget > 0
        ? `${chipMoney(budget)}${hint}`
        : undefined,
  };
}

/**
 * "2 adults, 1 child, 1 pet" from the stepper breakdown, or a plain "3 travellers" when the draft
 * has none — a brief loaded fresh (`draftFor`), or one saved before the steppers existed.
 */
function whoLabel(draft: Draft, travellers: number) {
  const plain = `${travellers} ${travellers === 1 ? "traveller" : "travellers"}`;
  const party = draft.party;
  if (!party) return plain;
  const parts = PARTY_ROWS.map(({ key, singular }) => {
    const count = party[key];
    return count > 0 ? `${count} ${count === 1 ? singular : `${singular}s`}` : undefined;
  }).filter((part): part is string => !!part);
  return parts.length ? parts.join(", ") : plain;
}
