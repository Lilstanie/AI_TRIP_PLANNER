import { dateForDay } from "./validation";

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
export function legMode(role: LegRole, from: string, to: string): LegMode {
  if (role === "inter-city") return "ground";
  return from.toLowerCase() === to.toLowerCase() ? "ground" : "flight";
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
