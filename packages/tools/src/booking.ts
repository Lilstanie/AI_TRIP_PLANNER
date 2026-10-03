// Internal compatibility surface for direct Booking adapter callers.
// ToolGateway uses the internal deep port so one Planning Run selects once.
import type { FlightQuery, StayQuery } from "@trip/shared";
import { createBookingPort } from "./booking-port";
import { snapshotToolRuntime } from "./runtime-context";

export type { StayQuery, StayOption, FlightQuery, FlightOption } from "@trip/shared";
export { SerpApiError, serpApiUsage } from "./serpapi";

export async function searchStays(query: StayQuery) {
  return createBookingPort(snapshotToolRuntime()).searchStays(query);
}

export async function searchFlights(query: FlightQuery) {
  return createBookingPort(snapshotToolRuntime()).searchFlights(query);
}

export async function searchReturnLeg(query: FlightQuery & { token: string }) {
  return createBookingPort(snapshotToolRuntime()).searchReturnLeg!(query);
}
