import type { FlightCandidate, FlightSelection } from "@trip/shared";

export type FlightOfferTag = "selected" | "cheapest" | "fastest" | "nonstop";

export type FlightOffer = {
  candidate: FlightCandidate;
  tags: FlightOfferTag[];
  minutes?: number;
};

export const FLIGHT_OFFER_LIMIT = 6;

function minutes(candidate: FlightCandidate): number | undefined {
  return candidate.outbound?.durationMin ?? candidate.durationMin;
}

function stops(candidate: FlightCandidate): number | undefined {
  return candidate.outbound ? candidate.outbound.layovers.length : candidate.stops;
}

function sameFare(candidate: FlightCandidate): string {
  return [candidate.carrier, candidate.price, stops(candidate), minutes(candidate)].join("|");
}

function lowest(
  offers: FlightCandidate[],
  measure: (candidate: FlightCandidate) => number | undefined,
): FlightCandidate | undefined {
  let best: FlightCandidate | undefined;
  let bestValue = Infinity;
  for (const candidate of offers) {
    const value = measure(candidate);
    if (value !== undefined && value < bestValue) {
      best = candidate;
      bestValue = value;
    }
  }
  return best;
}

export function flightOffers(flight: FlightSelection, limit = FLIGHT_OFFER_LIMIT): FlightOffer[] {
  const selected = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
  const seen = new Set<string>();
  const unique: FlightCandidate[] = [];
  for (const candidate of selected ? [selected, ...flight.candidates] : flight.candidates) {
    const key = sameFare(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  const byPrice = [...unique].sort((a, b) => a.price - b.price);
  const cheapest = byPrice[0];
  const fastest = lowest(unique, minutes);
  const nonstops = byPrice.filter((candidate) => stops(candidate) === 0);
  const carriers = new Set<string>();
  const perCarrier = byPrice.filter((candidate) => {
    if (carriers.has(candidate.carrier)) return false;
    carriers.add(candidate.carrier);
    return true;
  });
  const order = [selected, cheapest, fastest, nonstops[0], ...perCarrier, ...byPrice];
  const shown: FlightCandidate[] = [];
  for (const candidate of order) {
    if (!candidate || shown.includes(candidate)) continue;
    shown.push(candidate);
    if (shown.length === limit) break;
  }
  const timed = shown.filter((candidate) => minutes(candidate) !== undefined);
  const fastestShown = timed.length > 1 ? lowest(shown, minutes) : undefined;
  const nonstopShown = shown.some((candidate) => stops(candidate) !== 0)
    ? shown.filter((candidate) => stops(candidate) === 0).sort((a, b) => a.price - b.price)[0]
    : undefined;
  return shown.map((candidate) => {
    const tags: FlightOfferTag[] = [];
    if (candidate === selected) tags.push("selected");
    if (shown.length > 1 && candidate === cheapest) tags.push("cheapest");
    if (candidate === fastestShown && candidate === fastest) tags.push("fastest");
    if (candidate === nonstopShown) tags.push("nonstop");
    const total = minutes(candidate);
    return { candidate, tags, ...(total === undefined ? {} : { minutes: total }) };
  });
}
