import { z } from "zod";
import {
  COMMUNICATION_STYLES,
  Currency,
  MAX_TRIP_PREFERENCE_LENGTH,
  MAX_TRIP_PREFERENCES,
} from "@trip/shared";
import { blankDraft, type Draft } from "../workspace/workspace";
import { LOCALES } from "../i18n/locale";

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
    homeCity: z.string().trim().max(120),
    travellers: z.number().int().min(1).max(20).optional(),

    budget: z.number().positive().max(10_000_000).optional(),
    preferences: z
      .array(z.string().trim().min(1).max(MAX_TRIP_PREFERENCE_LENGTH))
      .max(MAX_TRIP_PREFERENCES),

    pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).default([]),
    dietary: z.array(z.enum(DIETARY)).max(DIETARY.length).default([]),
  }),

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

  assistant: z
    .object({ style: z.enum(COMMUNICATION_STYLES), memory: z.boolean() })
    .default({ style: "neutral", memory: true }),

  dataMode: z.enum(["default", "live", "mock"]),
  appearance: z.enum(["system", "light", "dark"]),

  language: z.enum(LOCALES).optional(),

  displayCurrency: Currency.default("AUD"),

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
  displayCurrency: "AUD",

  updatedAt: new Date(0).toISOString(),
});

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
