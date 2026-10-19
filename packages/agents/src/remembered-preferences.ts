import type { Place, UserPreference } from "@trip/shared";

export function rememberedPlanningPreferences(preferences: UserPreference[]) {
  const values = new Map(
    preferences
      .filter((preference) => preference.source === "chat_confirmed")
      .map((preference) => [preference.key, preference.value.toLocaleLowerCase()]),
  );
  return {
    pace: values.get("pace") ?? "",
    interests: (values.get("interests") ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean),
    accessibility: values.get("accessibility"),
  };
}

export function rankPlacesByInterests(places: readonly Place[], interests: string[]): Place[] {
  const rank = (place: Place) =>
    interests.some((interest) =>
      new RegExp(`\\b${interest}\\w*\\b`).test(place.category.toLocaleLowerCase()),
    )
      ? 0
      : 1;
  return [...places].sort((a, b) => rank(a) - rank(b));
}
