import { z } from "zod";
import {
  COMMUNICATION_STYLES,
  MAX_TRIP_PREFERENCE_LENGTH,
  MAX_TRIP_PREFERENCES,
} from "@trip/shared";
import { blankDraft, type Draft } from "../workspace/workspace";
import { LOCALES } from "../i18n/locale";

/**
 * A traveller's settings. Signed out they live in this browser (`SETTINGS_KEY`); signed in they
 * sync to `user_settings`. Travel defaults only prefill a new trip's facts — the traveller can
 * change any of them for that trip — and never rewrite a trip that already exists.
 */
export const INTERESTS = [
  "Food",
  "Culture & history",
  "Museums & art",
  "Nature & outdoors",
  "Beaches",
  "Nightlife",
  "Shopping",
  "Adventure",
  "Wellness",
  "Family friendly",
] as const;
export const DIETARY = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
] as const;

const PACE_TEXT = {
  relaxed: "Relaxed pace: two or three things a day, with free time",
  balanced: "Balanced pace",
  packed: "Packed days: see as much as possible",
} as const;

export const UserSettings = z.object({
  version: z.literal(1),
  travel: z.object({
    /** Where trips usually start, e.g. "Sydney". Empty means no default. */
    homeCity: z.string().trim().max(120),
    travellers: z.number().int().min(1).max(20).optional(),
    /** Whole-trip budget in AUD, the base currency every total uses. */
    budget: z.number().positive().max(10_000_000).optional(),
    preferences: z
      .array(z.string().trim().min(1).max(MAX_TRIP_PREFERENCE_LENGTH))
      .max(MAX_TRIP_PREFERENCES),
    /** How full a day should be. */
    pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).default([]),
    dietary: z.array(z.enum(DIETARY)).max(DIETARY.length).default([]),
  }),
  /** Airline and hotel loyalty programmes, kept for the traveller's reference. */
  memberships: z
    .array(
      z.object({
        kind: z.enum(["airline", "hotel"]),
        program: z.string().trim().min(1).max(80),
        number: z.string().trim().max(40).optional(),
      }),
    )
    .max(20)
    .default([]),
  /** Settings → Personalization; defaulted so settings saved before it existed still load. */
  assistant: z
    .object({ style: z.enum(COMMUNICATION_STYLES), memory: z.boolean() })
    .default({ style: "neutral", memory: true }),
  /** "default" follows the deployment's own setting. */
  dataMode: z.enum(["default", "live", "mock"]),
  appearance: z.enum(["system", "light", "dark"]),
  /** Interface language. Absent means follow the browser, so settings saved before it still load. */
  language: z.enum(LOCALES).optional(),
  /** When these settings last changed; the newer copy wins between browser and account. */
  updatedAt: z.string().datetime(),
});
export type UserSettings = z.infer<typeof UserSettings>;

export const SETTINGS_KEY = "trip.settings.v1";

export const defaultSettings = (): UserSettings => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "default",
  appearance: "system",
  // The epoch, so any settings the traveller actually saved are newer than the defaults.
  updatedAt: new Date(0).toISOString(),
});

/** A new trip's facts before the traveller types anything: blank, then the travel defaults. */
export function draftDefaults(settings: UserSettings): Draft {
  const { homeCity, travellers, budget, preferences, pace, interests, dietary } = settings.travel;
  return {
    ...blankDraft(),
    origin: homeCity,
    groupSize: travellers ? String(travellers) : "",
    budgetTotal: budget ? String(budget) : "",
    preferences: profilePreferences({ preferences, pace, interests, dietary }),
  };
}

/**
 * The travel profile as the trip-preference lines every specialist already reads: pace,
 * interests and dietary needs first, then the traveller's own standing preferences, capped at
 * the list's limit.
 */
export function profilePreferences(
  travel: Pick<UserSettings["travel"], "preferences" | "pace" | "interests" | "dietary">,
): string[] {
  return [
    ...(travel.pace ? [PACE_TEXT[travel.pace]] : []),
    ...(travel.interests.length ? [`Interests: ${travel.interests.join(", ")}`] : []),
    ...(travel.dietary.length ? [`Dietary: ${travel.dietary.join(", ")}`] : []),
    ...travel.preferences,
  ].slice(0, MAX_TRIP_PREFERENCES);
}
