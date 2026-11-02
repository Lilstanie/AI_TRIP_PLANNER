import type { AgentProposal } from "@trip/shared";
import type { CityNights, LegModeChoice, TravelMode } from "@trip/shared";
import { dateForDay } from "./validation";

export type ScheduledHop = { day: number; from: string; to: string };

export function parseCityHop(
  destination: string,
  location: string | undefined,
): Omit<ScheduledHop, "day"> | undefined {
  const names = cities(destination);
  const [rawFrom, rawTo] = (location ?? "").split(" → ").map((part) => part.trim());
  const from = names.find((name) => name.toLocaleLowerCase() === rawFrom?.toLocaleLowerCase());
  const to = names.find((name) => name.toLocaleLowerCase() === rawTo?.toLocaleLowerCase());
  return from && to ? { from, to } : undefined;
}

export function scheduledHops(destination: string, transport?: AgentProposal): ScheduledHop[] {
  return (transport?.items ?? [])
    .flatMap((item) => {
      const hop = parseCityHop(destination, item.location);
      return item.day !== undefined && hop ? [{ day: item.day, ...hop }] : [];
    })
    .sort((left, right) => left.day - right.day);
}

export function cities(destination: string): string[] {
  const result = destination
    .split(/\s*&\s*/)
    .map((city) => city.trim())
    .filter(Boolean);
  if (!result.length) throw new Error("Transport requires at least one destination.");
  return result;
}

export interface JourneyLeg {
  index: number;
  from: string;
  to: string;

  date: string;

  day: number;
  mode: LegMode;

  chosenMode?: TravelMode;
}

export type LegMode = "flight" | "ground";

export type LegRole = "arrival" | "inter-city";

export type ModePreference = TravelMode;

const sameName = (left: string, right: string) =>
  left.trim().toLowerCase().replace(/\s+/g, " ") ===
  right.trim().toLowerCase().replace(/\s+/g, " ");

export function chosenModeFor(
  choices: readonly LegModeChoice[] | undefined,
  from: string,
  to: string,
): TravelMode | undefined {
  return choices?.find((choice) => sameName(choice.from, from) && sameName(choice.to, to))?.mode;
}

export function legMode(
  role: LegRole,
  from: string,
  to: string,
  preference?: ModePreference,
): LegMode {
  if (preference) return preference === "flight" ? "flight" : "ground";

  if (role === "inter-city") return "ground";
  return from.toLowerCase() === to.toLowerCase() ? "ground" : "flight";
}

export function flownInstead(leg: JourneyLeg): JourneyLeg {
  return { ...leg, mode: "flight" };
}

export function journeyLegs(input: {
  origin: string;
  destinations: string[];

  start: string;

  days: number;

  legModes?: readonly LegModeChoice[];

  cityNights?: readonly CityNights[];
}): JourneyLeg[] {
  const { origin, destinations, start, days, legModes, cityNights } = input;
  const startsOn = cityStartDays(destinations, days, cityNights);
  if (!destinations.length) throw new Error("A journey needs at least one destination.");
  const first = destinations[0]!;
  const arrivesFromElsewhere = origin.toLowerCase() !== first.toLowerCase();
  const legs: JourneyLeg[] = [];

  if (arrivesFromElsewhere) {
    const chosen = chosenModeFor(legModes, origin, first);
    legs.push({
      index: 0,
      from: origin,
      to: first,
      date: start,
      day: 1,
      mode: legMode("arrival", origin, first, chosen),
      ...(chosen ? { chosenMode: chosen } : {}),
    });
  }

  destinations.slice(1).forEach((to, hop) => {
    const day = startsOn[hop + 1]!;
    const chosen = chosenModeFor(legModes, destinations[hop]!, to);
    legs.push({
      index: legs.length,
      from: destinations[hop]!,
      to,
      date: dateForDay(start, day),
      day,
      mode: legMode("inter-city", destinations[hop]!, to, chosen),
      ...(chosen ? { chosenMode: chosen } : {}),
    });
  });

  return legs;
}

export const flightLegs = (legs: JourneyLeg[]) => legs.filter((leg) => leg.mode === "flight");
export const groundLegs = (legs: JourneyLeg[]) => legs.filter((leg) => leg.mode === "ground");

export function cityStartDays(
  cities: readonly string[],
  days: number,
  cityNights?: readonly CityNights[],
): number[] {
  const even = cities.map((_, index) =>
    index === 0 ? 1 : Math.min(days, Math.floor((days * index) / cities.length) + 1),
  );
  if (!cityNights?.length || cities.length < 2) return even;
  const asked = cities.map(
    (city) => cityNights.find((entry) => sameName(entry.city, city))?.nights,
  );
  if (asked.every((nights) => nights === undefined)) return even;
  const total = days - 1;
  const named = asked.reduce<number>((sum, nights) => sum + (nights ?? 0), 0);
  const unnamed = asked.filter((nights) => nights === undefined).length;
  const left = total - named;
  if (left < unnamed || (unnamed === 0 && left !== 0)) return even;
  let share = 0;
  const nights = asked.map((nights) => {
    if (nights !== undefined) return nights;
    const next = Math.floor(left / unnamed) + (share < left % unnamed ? 1 : 0);
    share += 1;
    return next;
  });
  return nights.map((_, index) => 1 + nights.slice(0, index).reduce((sum, n) => sum + n, 0));
}

export function cityForDay(
  cities: string[],
  days: number,
  cityNights?: readonly CityNights[],
): string[] {
  if (!cities.length) throw new Error("A journey needs at least one destination.");
  const startsOn = cityStartDays(cities, days, cityNights);
  return Array.from({ length: days }, (_, offset) => {
    const day = offset + 1;
    let city = cities[0]!;
    startsOn.forEach((start, index) => {
      if (day >= start) city = cities[index]!;
    });
    return city;
  });
}
