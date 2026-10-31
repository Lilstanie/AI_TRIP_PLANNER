import type { InterfaceLanguage, Place } from "@trip/shared";
import { summaryCopy } from "../summary-copy";
import { beforeLanding, minutes, type Landing } from "./landing";
import { activityFitsTransferWindows, type TransferWindow } from "./transfer-windows";

type Activity = {
  day: number;
  startTime: string;
  endTime: string;
  location: string;
  detail: string;
};

const MEAL_SLOTS = [
  { startTime: "12:15", endTime: "13:15" },
  { startTime: "11:45", endTime: "12:45" },
  { startTime: "18:30", endTime: "19:45" },
] as const;

export const PACKED_MEAL_SLOTS = [
  { startTime: "12:45", endTime: "13:45" },
  { startTime: "18:30", endTime: "19:45" },
] as const;

export function withMeals<T extends { activities: Activity[] }>(
  draft: T,
  days: number,
  mealsByCity: ReadonlyMap<string, readonly Place[]>,
  dayCities: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]>,
  landing: Landing | undefined,
  language: InterfaceLanguage | undefined,
  packed = false,
): T {
  const slots = packed ? PACKED_MEAL_SLOTS : MEAL_SLOTS;
  const mealsPerDay = packed ? 2 : 1;
  const used = new Map<string, number>();
  const meals: Activity[] = [];
  for (let day = 1; day <= days; day += 1) {
    const booked = draft.activities.filter((activity) => activity.day === day);
    let added = 0;
    for (const slot of slots) {
      if (beforeLanding({ day, startTime: slot.startTime }, landing)) continue;
      if (
        booked.some(
          (activity) =>
            minutes(slot.startTime) < minutes(activity.endTime) &&
            minutes(slot.endTime) > minutes(activity.startTime),
        )
      )
        continue;
      const windows = transferWindows.get(day) ?? [];
      const city = (dayCities[day - 1] ?? []).find(
        (candidate) =>
          (mealsByCity.get(candidate)?.length ?? 0) > 0 &&
          activityFitsTransferWindows(slot, candidate, windows),
      );
      if (!city) continue;
      const options = mealsByCity.get(city)!;
      const index = used.get(city) ?? 0;
      used.set(city, index + 1);
      const place = options[index % options.length]!;
      const meal = {
        day,
        ...slot,
        location: place.name,
        detail: summaryCopy(language).mealStop(place.name),
      };
      meals.push(meal);
      booked.push(meal);
      added += 1;
      if (added === mealsPerDay) break;
    }
  }
  return {
    ...draft,
    activities: [...draft.activities, ...meals].sort(
      (left, right) => left.day - right.day || minutes(left.startTime) - minutes(right.startTime),
    ),
  };
}

export function withGrounded(
  places: readonly Place[],
  placesByCity: ReadonlyMap<string, readonly Place[]>,
  mealsByCity: ReadonlyMap<string, readonly Place[]>,
): { places: Place[]; byCity: Map<string, Place[]> } {
  const byCity = new Map<string, Place[]>();
  for (const [city, found] of [...placesByCity, ...mealsByCity])
    byCity.set(city, [...(byCity.get(city) ?? []), ...found]);
  return { places: [...places, ...[...mealsByCity.values()].flat()], byCity };
}

export function mealsByCityFrom(
  found: ReadonlyArray<readonly [string, readonly Place[]]>,
  sights: readonly Place[],
): Map<string, Place[]> {
  const sightNames = new Set(sights.map((place) => place.name.trim().toLowerCase()));
  return new Map(
    found.map(([city, places]) => [
      city,
      [
        ...new Map(
          places
            .filter((place) => !sightNames.has(place.name.trim().toLowerCase()))
            .map((place) => [place.name.trim().toLowerCase(), place]),
        ).values(),
      ],
    ]),
  );
}
