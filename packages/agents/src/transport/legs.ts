import { dateForDay } from "./validation";

/** Parse the demo's ampersand-separated destination convention. */
export function cities(destination: string): string[] {
  const result = destination
    .split(/\s*&\s*/)
    .map((city) => city.trim())
    .filter(Boolean);
  if (!result.length) throw new Error("Transport requires at least one destination.");
  return result;
}


/**
 * One hop of a journey, in travel order: origin → city 1 → city 2 → …
 *
 * The journey used to be implicit — a single hardcoded flight query for
 * `origin → destinations[0]`, plus a separate list of inter-city route
 * queries. Adding a second flown hop meant editing four places that each
 * re-derived the itinerary their own way. Deriving every hop from one ordered
 * list makes A→B→C→D a change of policy rather than a rewrite.
 */
export interface JourneyLeg {
  /** Position in travel order; 0 reaches the first destination. */
  index: number;
  from: string;
  to: string;
  /** ISO date the hop is planned for. */
  date: string;
  /** 1-based planning day. */
  day: number;
  mode: LegMode;
}

export type LegMode = "flight" | "ground";

/** What a hop is for, which is what decides how it is made. */
export type LegRole = "arrival" | "inter-city";

/**
 * A mode the traveller asked for on a hop, overriding what the planner would
 * pick. Nothing sets this yet; it exists so choosing "train, not a flight" is
 * a value threaded through the existing decision rather than a second code
 * path bolted alongside it.
 */
export type ModePreference = LegMode;

/**
 * Which hops are flown.
 *
 * Today: only the arrival — the hop that brings the traveller to the first
 * destination — and only when it starts somewhere else. Every hop between
 * cities is ground travel, because a multi-city trip inside one region
 * (Tokyo → Kyoto, Sydney → Parramatta) is a train, not a flight.
 *
 * The role is passed in rather than inferred from position. Keying on "index
 * 0" looked equivalent and was not: a trip whose origin is already its first
 * destination has no arrival hop, so the first inter-city hop inherited index 0
 * and was priced as a flight — Sydney to Parramatta, 25km apart, went to the
 * airline search and came back unpriced.
 *
 * This is the one function to change when B→C and C→D should also be flown.
 */
export function legMode(
  role: LegRole,
  from: string,
  to: string,
  preference?: ModePreference,
): LegMode {
  // A stated choice wins: the planner's guess is a default, not a rule.
  if (preference) return preference;
  // Inter-city hops start as ground and are promoted to a flight only when the
  // ground journey turns out not to fit a planning day — a decision that needs
  // provider durations, so it cannot be made here.
  if (role === "inter-city") return "ground";
  return from.toLowerCase() === to.toLowerCase() ? "ground" : "flight";
}

/** The same leg, flown instead of driven or ridden. */
export function flownInstead(leg: JourneyLeg): JourneyLeg {
  return { ...leg, mode: "flight" };
}

/**
 * The hops a brief implies, in travel order.
 *
 * A trip whose origin is its own destination gets an arrival transfer instead
 * of a flight, and only when there is nothing else to travel — otherwise the
 * first inter-city hop is already the traveller's first real movement.
 */
export function journeyLegs(input: {
  origin: string;
  destinations: string[];
  /** The brief's first date; hop dates are derived from it. */
  start: string;
  /** Total planning days, used to spread hops across the trip. */
  days: number;
}): JourneyLeg[] {
  const { origin, destinations, start, days } = input;
  if (!destinations.length) throw new Error("A journey needs at least one destination.");
  const first = destinations[0]!;
  const arrivesFromElsewhere = origin.toLowerCase() !== first.toLowerCase();
  const legs: JourneyLeg[] = [];

  if (arrivesFromElsewhere) {
    legs.push({
      index: 0,
      from: origin,
      to: first,
      date: start,
      day: 1,
      mode: legMode("arrival", origin, first),
    });
  } else if (destinations.length === 1) {
    // Same city, nothing else to travel: the only movement worth planning is
    // getting in from the airport.
    legs.push({
      index: 0,
      from: `${first} airport`,
      to: first,
      date: start,
      day: 1,
      mode: "ground",
    });
  }

  destinations.slice(1).forEach((to, hop) => {
    // Spread the inter-city hops evenly across the trip, counted against the
    // cities rather than the legs so a flown first hop does not shift them.
    const day = Math.min(days, Math.floor((days * (hop + 1)) / destinations.length) + 1);
    legs.push({
      index: legs.length,
      from: destinations[hop]!,
      to,
      date: dateForDay(start, day),
      day,
      mode: legMode("inter-city", destinations[hop]!, to),
    });
  });

  return legs;
}

export const flightLegs = (legs: JourneyLeg[]) => legs.filter((leg) => leg.mode === "flight");
export const groundLegs = (legs: JourneyLeg[]) => legs.filter((leg) => leg.mode === "ground");

/**
 * Which city each planning day belongs to, counted the same way the journey
 * legs are: a hop's day is where that city's stay begins.
 *
 * Shared so the itinerary and the transport plan cannot disagree. They did:
 * the itinerary cycled through every city's places regardless of day, so a
 * five-day Sydney and Wollongong trip put a Wollongong lookout and the Sydney
 * CBD in the same afternoon, two hours apart.
 */
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
