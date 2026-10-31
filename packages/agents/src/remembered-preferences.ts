import type { Place, TripIntent, UserPreference } from "@trip/shared";

/** Pace and interests from the brief's intent win over the account memory; pace is `""` when neither gives one. */
export function rememberedPlanningPreferences(preferences: UserPreference[], intent?: TripIntent) {
  const values = new Map(
    preferences
      .filter((preference) => preference.source === "chat_confirmed")
      .map((preference) => [preference.key, preference.value.toLocaleLowerCase()]),
  );
  return {
    pace: intent?.pace ?? values.get("pace") ?? "",
    interests: intent?.interests?.length
      ? [...intent.interests]
      : (values.get("interests") ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean),
    accessibility: values.get("accessibility"),
  };
}

export function rankPlacesByInterests(places: readonly Place[], interests: string[]): Place[] {
  const rank = (place: Place) =>
    interests.some((interest) =>
      new RegExp(`\\b${interest.replace(/s$/, "")}\\w*\\b`).test(
        place.category.toLocaleLowerCase(),
      ),
    )
      ? 0
      : 1;
  return [...places].sort((a, b) => rank(a) - rank(b));
}
