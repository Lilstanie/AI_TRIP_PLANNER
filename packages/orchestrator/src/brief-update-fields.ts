import {
  LASTING_PREFERENCE_KEYS,
  MAX_TRIP_PREFERENCE_LENGTH,
  STAY_TYPES,
  TRIP_INTERESTS,
  TRIP_PACES,
  type LastingPreference,
  type TripIntent,
} from "@trip/shared";

export interface IntentFields {
  pace?: unknown;
  dietary?: unknown;
  interests?: unknown;
  stayMinRating?: unknown;
  stayFreeCancellation?: unknown;
  stayType?: unknown;
  rememberForAccount?: { key: (typeof LASTING_PREFERENCE_KEYS)[number]; value: unknown }[] | null;
}

export function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return !trimmed || /^(null|none|n\/a|undefined|unknown)$/i.test(trimmed) ? undefined : trimmed;
}
export function count(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(text(value)?.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
const shortList = (items: unknown, limit: number) =>
  Array.isArray(items)
    ? [
        ...new Set(
          items
            .map((item) => text(item)?.slice(0, MAX_TRIP_PREFERENCE_LENGTH))
            .filter((item): item is string => Boolean(item)),
        ),
      ].slice(0, limit)
    : undefined;

function oneOf<T extends string>(options: readonly T[], value: unknown): T | undefined {
  const found = text(value)?.toLowerCase();
  return options.find((option) => option === found);
}

export function intentFrom(update: IntentFields): TripIntent | undefined {
  const pace = oneOf(TRIP_PACES, update.pace);
  const dietary = shortList(update.dietary, 8);
  const interests = shortList(update.interests, TRIP_INTERESTS.length)
    ?.map((item) => oneOf(TRIP_INTERESTS, item))
    .filter((item) => item !== undefined);
  const rating = count(update.stayMinRating);
  const stay = {
    ...(rating !== undefined && rating <= 10 ? { minRating: rating } : {}),
    ...(typeof update.stayFreeCancellation === "boolean"
      ? { freeCancellation: update.stayFreeCancellation }
      : {}),
    ...(oneOf(STAY_TYPES, update.stayType) ? { stayType: oneOf(STAY_TYPES, update.stayType) } : {}),
  };
  const intent: TripIntent = {
    ...(pace ? { pace } : {}),
    ...(dietary ? { dietary } : {}),
    ...(interests ? { interests } : {}),
    ...(Object.keys(stay).length ? { stay } : {}),
  };
  return Object.keys(intent).length ? intent : undefined;
}

export function lastingPreferencesFrom(update: IntentFields): LastingPreference[] | undefined {
  if (!Array.isArray(update.rememberForAccount)) return undefined;
  const entries = update.rememberForAccount.flatMap((entry): LastingPreference[] => {
    const value = text(entry.value)?.slice(0, 200);
    if (!value) return [];
    if (entry.key !== "pace") return [{ key: entry.key, value }];
    const pace = oneOf(TRIP_PACES, value.replace(/\s*pace$/i, ""));
    return pace ? [{ key: entry.key, value: pace }] : [];
  });
  return entries.slice(0, 4);
}
