import { formatMoney, type Currency } from "./money";

export function describeFlightChoice(input: {
  from: string;
  to: string;
  carrier: string;

  note?: string;

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

  rating: number;
  freeCancellation: boolean;

  cost: number;

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

export function stayChoiceCost(pricePerNight: number, rooms: number, nights: number): number {
  return Math.round(pricePerNight * rooms * nights * 100) / 100;
}
