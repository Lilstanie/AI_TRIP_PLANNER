// How a priced choice reads on a proposal item.
//
// The specialists write these sentences when they first plan, and the plan
// editor rewrites them when the traveller picks a different candidate. Both
// need the same wording, or swapping a fare would leave the plan describing
// the same purchase in two voices. @trip/shared is the only package both of
// them already depend on, so the sentences live here.
// Owner: A.

import { formatMoney, type Currency } from "./money";

export function describeFlightChoice(input: {
  from: string;
  to: string;
  carrier: string;
  /** The provider's own words about this fare, when it gave any. */
  note?: string;
  /** Set only on a return trip, and only for the hop that comes home. */
  returning?: string;
}): string {
  const returning = input.returning ? `, returning ${input.returning}` : "";
  return `${input.carrier}: ${input.from} to ${input.to}${returning}; whole-group fare${
    input.note ? `; ${input.note}` : ""
  }.`;
}

export function describeStayChoice(input: {
  name: string;
  area: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  nights: number;
  pricePerNight: number;
  /** The provider's 0-10 scale; shown out of 5, as the cards do. */
  rating: number;
  freeCancellation: boolean;
  /** rooms × nights × pricePerNight, already rounded by the caller. */
  cost: number;
  /** The trip's display currency; AUD when absent. The amounts passed in are AUD planning amounts. */
  currency?: Currency;
}): string {
  const aud = (amount: number) => formatMoney(amount, input.currency ?? "AUD");
  return (
    `${input.name} — ${input.area}; ${input.checkIn} to ${input.checkOut}; ` +
    `${input.rooms} room(s) × ${input.nights} night(s) × ${aud(input.pricePerNight)} per room/night ` +
    `= ${aud(input.cost)}; rating ${(input.rating / 2).toFixed(1)}/5; ` +
    `${input.freeCancellation ? "free cancellation" : "no free cancellation"}.`
  );
}

/** rooms × nights × the nightly rate, in whole cents. */
export function stayChoiceCost(pricePerNight: number, rooms: number, nights: number): number {
  return Math.round(pricePerNight * rooms * nights * 100) / 100;
}
