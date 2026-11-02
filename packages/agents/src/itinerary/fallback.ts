import {
  TRIP_PACES,
  type InterfaceLanguage,
  type Place,
  type TripBrief,
  type TripPace,
  type UserPreference,
} from "@trip/shared";
import { cities, cityForDay } from "../transport/legs";
import { rankPlacesByInterests, rememberedPlanningPreferences } from "../remembered-preferences";
import { summaryCopy } from "../summary-copy";
import { arrivalSlots, type Landing } from "./landing";
import {
  activityFitsTransferWindows,
  blockedAllDay,
  type TransferWindow,
} from "./transfer-windows";
import type { ItineraryDraft } from "./index";

const DAY_SLOTS = [
  { startTime: "09:30", endTime: "12:00" },
  { startTime: "14:00", endTime: "16:30" },
] as const;

const SINGLE_SLOT = { startTime: "13:00", endTime: "16:00" } as const;

const EVENING_SLOT = { startTime: "19:30", endTime: "21:30" } as const;

const NIGHT_PLACE = /night|bar\b|pub\b|club|live music|speakeasy|broadway|theat(?:er|re)|夜/i;

const PACKED_SLOTS = [
  { startTime: "08:30", endTime: "10:00" },
  { startTime: "10:45", endTime: "12:00" },
  { startTime: "14:30", endTime: "15:45" },
  { startTime: "16:30", endTime: "17:45" },
] as const;

export function planningPace(brief: TripBrief, preferences: UserPreference[]): TripPace {
  const { pace } = rememberedPlanningPreferences(preferences, brief.intent);
  return TRIP_PACES.find((option) => pace.includes(option)) ?? "balanced";
}

export function fallbackDraft(
  brief: TripBrief,
  days: number,
  places: Place[],
  preferences: UserPreference[],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
  dayCities?: string[][],
  transferWindows: ReadonlyMap<number, TransferWindow[]> = new Map(),
  language?: InterfaceLanguage,
  landing?: Landing,
): ItineraryDraft {
  const candidates = places;
  const { interests, accessibility } = rememberedPlanningPreferences(preferences, brief.intent);
  const pace = planningPace(brief, preferences);

  const cityNames = cities(brief.destination);
  const citiesByDay = dayCities ?? cityForDay(cityNames, days).map((city) => [city]);
  const placesForCity = (city: string): readonly Place[] => {
    const inCity = placesByCity?.get(city) ?? [];
    return placesByCity && placesByCity.size > 1 ? inCity : inCity.length ? inCity : candidates;
  };

  const scarcest = Math.min(
    ...Array.from(
      { length: days },
      (_, day) => placesForCity(citiesByDay[day]?.at(-1) ?? cityNames[0]!).length,
    ),
  );
  const daySlots = pace === "packed" && !accessibility ? PACKED_SLOTS : DAY_SLOTS;
  const perDay =
    accessibility || pace === "relaxed"
      ? 1
      : Math.min(daySlots.length, Math.max(1, Math.floor(scarcest / 2) || 1));

  const slots = perDay === 1 ? [SINGLE_SLOT, ...DAY_SLOTS] : daySlots;
  const activities: ItineraryDraft["activities"] = [];
  const incompleteDays: number[] = [];
  const visits = new Map<string, number>();
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = dayIndex + 1;
    const dayWindows = transferWindows.get(day) ?? [];
    const dayCitiesForActivities = citiesByDay[dayIndex] ?? [cityNames[0]!];
    if (landing && (day < landing.day || (day === landing.day && !landing.earliestStart))) continue;
    if (blockedAllDay(transferWindows, day)) continue;
    const openSlots = landing?.day === day ? arrivalSlots(slots, landing) : slots;
    let added = 0;
    for (const slot of openSlots) {
      const city = dayCitiesForActivities.find((candidate) => {
        const cityPlaces = placesForCity(candidate);
        if (!cityPlaces.length) return false;
        return activityFitsTransferWindows(slot, candidate, dayWindows);
      });
      if (!city) continue;
      const cityPlaces = rankPlacesByInterests(placesForCity(city), interests);
      const visit = visits.get(city) ?? 0;
      visits.set(city, visit + 1);
      const place = cityPlaces[visit % cityPlaces.length]!;
      const evening =
        NIGHT_PLACE.test(`${place.name} ${place.category}`) &&
        !activities.some(
          (activity) => activity.day === day && activity.startTime === EVENING_SLOT.startTime,
        ) &&
        activityFitsTransferWindows(EVENING_SLOT, city, dayWindows);
      activities.push({
        day,
        ...(evening ? EVENING_SLOT : slot),
        location: place.name,
        detail: summaryCopy(language).suggestedStop(place.name, place.category),
      });
      added += 1;
      if (added === perDay) break;
    }
    if (!added) incompleteDays.push(day);
  }
  return {
    summary: summaryCopy(language).itinerary(days, brief.destination, perDay),
    activities,
    assumptions: [
      "Opening hours and live availability must be confirmed before plans are finalised.",
      perDay === 1
        ? "One grounded activity is scheduled each day; the rest of each day is left open."
        : perDay > 2
          ? `Up to ${perDay} grounded stops a day for a packed pace, with lunch and dinner between them.`
          : "Two anchored stops a day, with the middle of the day left for a meal and the journey between them.",
      ...(pace === "relaxed"
        ? ["The remembered relaxed pace is reflected in the one-activity daily schedule."]
        : []),
      ...(interests.length
        ? [
            `Grounded candidates matching remembered interests (${interests.join(", ")}) are preferred when available.`,
          ]
        : []),
      ...(accessibility
        ? [
            `The schedule is limited to one grounded activity per day for the remembered ${accessibility} need; place access and routes are not verified.`,
          ]
        : []),
      ...incompleteDays.map(
        (day) =>
          `Day ${day} is incomplete because no grounded activity fits the existing slots and scheduled transfer window; no late activity time was invented.`,
      ),
    ],
  };
}
