import type { AgentProposal } from "@trip/shared";
import type { LegModeChoice, TravelMode } from "@trip/shared";
import { dateForDay } from "./validation";

export type ScheduledHop = { day: number; from: string; to: string };

export function scheduledHops(destination: string, transport?: AgentProposal): ScheduledHop[] {
  const names = cities(destination);
  const lower = names.map((name) => name.toLocaleLowerCase());
  return (transport?.items ?? [])
    .flatMap((item) => {
      const [from, to] = (item.location ?? "").split(" → ").map((part) => part.trim());
      const fromIndex = lower.indexOf((from ?? "").toLocaleLowerCase());
      const toIndex = lower.indexOf((to ?? "").toLocaleLowerCase());
      return item.day !== undefined && fromIndex >= 0 && toIndex >= 0
        ? [{ day: item.day, from: names[fromIndex]!, to: names[toIndex]! }]
        : [];
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
}): JourneyLeg[] {
  const { origin, destinations, start, days, legModes } = input;
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
  } else if (destinations.length === 1) {
    const chosen = chosenModeFor(legModes, `${first} airport`, first);
    legs.push({
      index: 0,
      from: `${first} airport`,
      to: first,
      date: start,
      day: 1,
      mode: "ground",
      ...(chosen && chosen !== "flight" ? { chosenMode: chosen } : {}),
    });
  }

  destinations.slice(1).forEach((to, hop) => {
    const day = Math.min(days, Math.floor((days * (hop + 1)) / destinations.length) + 1);
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

export function cityForDay(cities: string[], days: number): string[] {
  if (!cities.length) throw new Error("A journey needs at least one destination.");
  const startsOn = cities.map((_, index) =>
    index === 0 ? 1 : Math.min(days, Math.floor((days * index) / cities.length) + 1),
  );
  return Array.from({ length: days }, (_, offset) => {
    const day = offset + 1;
    let city = cities[0]!;
    startsOn.forEach((start, index) => {
      if (day >= start) city = cities[index]!;
    });
    return city;
  });
}
