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

/**
 * Which hops are flown.
 *
 * Today: only the hop that reaches the first destination, and only when it
 * actually starts somewhere else. Every later hop is ground travel, because a
 * multi-city trip in one region (Tokyo → Kyoto) is a train, not a flight.
 *
 * This is the one function to change when B→C and C→D should also be priced as
 * flights — everything downstream already follows whatever it returns.
 */
export function legMode(index: number, from: string, to: string): LegMode {
  if (index > 0) return "ground";
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
    legs.push({ index: 0, from: origin, to: first, date: start, day: 1, mode: "flight" });
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
      mode: legMode(legs.length, destinations[hop]!, to),
    });
  });

  return legs;
}

export const flightLegs = (legs: JourneyLeg[]) => legs.filter((leg) => leg.mode === "flight");
export const groundLegs = (legs: JourneyLeg[]) => legs.filter((leg) => leg.mode === "ground");
