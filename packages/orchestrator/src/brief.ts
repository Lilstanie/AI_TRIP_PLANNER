import {
  TripBrief as TripBriefSchema,
  BookedStay,
  Currency,
  LegModeChoice,
  TripPreferences,
  TravellerParty,
  partyPeople,
  type TripBrief,
} from "@trip/shared";
import { z } from "zod/v4";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const BriefPatchSchema = z.object({
  destination: z.string().trim().min(1).optional(),
  origin: z.string().trim().min(1).optional(),
  dates: z.tuple([z.string().regex(ISO_DATE), z.string().regex(ISO_DATE)]).optional(),
  dateStart: z.string().regex(ISO_DATE).optional(),
  dateEnd: z.string().regex(ISO_DATE).optional(),
  groupSize: z.number().int().positive().optional(),
  party: TravellerParty.optional(),
  budgetTotal: z.number().positive().optional(),
  budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),
  displayCurrency: Currency.optional(),
  nationality: z.string().trim().min(1).optional(),

  preferences: TripPreferences.optional(),

  learnedPreferences: TripPreferences.optional(),
  excludeFlights: z.boolean().optional(),
  legModes: z.array(LegModeChoice).max(12).optional(),
  bookedStay: BookedStay.optional(),
  noAccommodation: z.boolean().optional(),
});
export type BriefPatch = z.infer<typeof BriefPatchSchema>;

export function isRealDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    ISO_DATE.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}

export function mergeBriefPatch<T extends BriefPatch>(current: T, patch: BriefPatch) {
  const parsedPatch = BriefPatchSchema.parse(patch);
  const next = { ...current, ...parsedPatch };
  if (parsedPatch.dateStart !== undefined || parsedPatch.dateEnd !== undefined) {
    const start = parsedPatch.dateStart ?? parsedPatch.dates?.[0] ?? current.dates?.[0];
    const end = parsedPatch.dateEnd ?? parsedPatch.dates?.[1] ?? current.dates?.[1];
    if (start && end) next.dates = [start, end];
    else delete next.dates;
  }
  delete next.dateStart;
  delete next.dateEnd;
  if (parsedPatch.budgetTotal !== undefined && parsedPatch.budgetSource === undefined)
    delete next.budgetSource;

  if (parsedPatch.party && parsedPatch.groupSize === undefined && current.groupSize === undefined)
    next.groupSize = partyPeople(parsedPatch.party);
  if (next.party && next.groupSize !== undefined && partyPeople(next.party) !== next.groupSize)
    delete next.party;
  return next;
}

export function applyBriefPatch(current: TripBrief, patch: BriefPatch, tripId: string): TripBrief {
  const next = TripBriefSchema.parse({ ...mergeBriefPatch(current, patch), tripId });
  if (!isRealDate(next.dates[0]) || !isRealDate(next.dates[1])) {
    throw new Error(
      "Those trip dates are not real calendar dates. Please restate the start and end dates.",
    );
  }
  if (Date.parse(next.dates[1]) <= Date.parse(next.dates[0])) {
    throw new Error("Trip end date must be after the start date.");
  }
  return next;
}
