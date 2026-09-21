import { TripBrief as TripBriefSchema, Currency, type TripBrief } from "@trip/shared";
import { z } from "zod/v4";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A partial update to a trip brief. `dates` stays a whole tuple: a half-applied
 * range is never meaningful, so a caller that knows only one end holds it back.
 */
export const BriefPatchSchema = z.object({
  destination: z.string().trim().min(1).optional(),
  origin: z.string().trim().min(1).optional(),
  dates: z.tuple([z.string().regex(ISO_DATE), z.string().regex(ISO_DATE)]).optional(),
  groupSize: z.number().int().positive().optional(),
  budgetTotal: z.number().positive().optional(),
  budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),
  nationality: z.string().trim().min(1).optional(),
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

export function applyBriefPatch(current: TripBrief, patch: BriefPatch, tripId: string): TripBrief {
  const parsedPatch = BriefPatchSchema.parse(patch);
  const next = TripBriefSchema.parse({ ...current, ...parsedPatch, tripId });
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
