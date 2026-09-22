// Ports — the interfaces the Orchestrator injects into every agent via
// AgentContext. @trip/tools and @trip/services implement these; agents depend
// only on the interface, so they stay testable (pass a fake in a unit test).
// Owner: A.

import type { ChatTurn, FlightLeg, UserPreference } from "./contracts";

// --- Maps / Places port (implemented by @trip/tools/maps) -------------------
export interface RouteQuery {
  from: string;
  to: string;
  date?: string;
  /** Explicit RFC 3339 departure instant; providers may skip local-time lookup. */
  departureTime?: string;
  /** Local wall-clock departure time for `date`, in HH:MM (defaults to 09:00). */
  localTime?: string;
}
export type TravelMode = "train" | "flight" | "bus" | "walk" | "transit" | "tram" | "ferry" | "drive";
export interface RouteLeg {
  mode: TravelMode;
  durationMin: number;
  price: number;
  note?: string;
}
export interface PlaceQuery {
  near: string;
  category?: string;
}
export interface Place {
  name: string;
  category: string;
  rating?: number;
  location?: { latitude: number; longitude: number };
}
export interface ProviderProvenance {
  kind: "live" | "estimated" | "mock";
  provider: string;
  queriedAt?: string;
  fallbackFrom?: string;
  fallbackReason?: string;
}
/**
 * One way of making a hop, as an alternative to the others — driving instead of
 * the bus, not driving *and then* the bus.
 *
 * RouteLeg[] is a single journey's consecutive segments: callers sum their
 * durations and advance a clock through them. Alternatives cannot travel in
 * that shape without reading as one very long trip, so they have their own.
 */
export interface RouteOption {
  mode: TravelMode;
  durationMin: number;
  distanceMeters?: number;
  /** Known cost in BASE_CURRENCY (road tolls, a published fare), else 0. */
  price: number;
  /** Whether `price` is the whole cost or only the part a provider reported. */
  priceBasis: "complete" | "partial" | "unavailable";
  note?: string;
}
export interface MapsPort {
  route(q: RouteQuery): Promise<RouteLeg[]>;
  places(q: PlaceQuery): Promise<Place[]>;
  /** Ways to make this hop, best first. Optional: not every adapter has them. */
  routeOptions?(q: RouteQuery): Promise<RouteOption[]>;
}

// --- Booking / Price port (implemented by @trip/tools/booking) --------------
export interface StayQuery {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}
export interface StayOption {
  name: string;
  area: string;
  pricePerNight: number;
  rating: number;
  freeCancellation: boolean;
  /** true for a real property from a grounded provider; see contracts.ts StayCandidate. */
  grounded?: boolean;
  /** GPS coordinates, when the provider reports them (e.g. SerpApi Google Hotels). */
  location?: { latitude: number; longitude: number };
  /** Link to the property's details page, when the provider reports one. */
  detailsUrl?: string;
  /** Provider and pricing status for traveller-facing source labels. */
  provenance?: ProviderProvenance;
  /** The flights themselves, when the provider described them. */
  outbound?: FlightLeg;
  inbound?: FlightLeg;
  roundTrip?: boolean;
  /**
   * Opaque provider handle for fetching this itinerary's return flights.
   * Google Flights returns outbound options first; the returns for one of them
   * are a second search, so a round-trip fare arrives without its way home.
   */
  returnToken?: string;
}
export interface FlightQuery {
  from: string;
  to: string;
  depart: string;
  return?: string;
  passengers: number;
}
export interface FlightOption {
  carrier: string;
  price: number;
  note?: string;
  /** Number of layovers (0 = nonstop), when the provider reports it. */
  stops?: number;
  /** Total scheduled flight time in minutes, when the provider reports it. */
  durationMin?: number;
  /** Provider and pricing status for traveller-facing source labels. */
  provenance?: ProviderProvenance;
  /** The flights themselves, when the provider described them. */
  outbound?: FlightLeg;
  inbound?: FlightLeg;
  roundTrip?: boolean;
  /**
   * Opaque provider handle for fetching this itinerary's return flights.
   * Google Flights returns outbound options first; the returns for one of them
   * are a second search, so a round-trip fare arrives without its way home.
   */
  returnToken?: string;
}
export interface BookingPort {
  searchStays(q: StayQuery): Promise<StayOption[]>;
  searchFlights(q: FlightQuery): Promise<FlightOption[]>;
  /**
   * The return flights for one outbound itinerary, identified by the token its
   * search returned. Optional: a provider that answers a round trip in one
   * call has nothing to add here. Each call is another provider search, so
   * callers fetch it only for itineraries they are about to show in full.
   */
  searchReturnLeg?(q: FlightQuery & { token: string }): Promise<FlightLeg | undefined>;
}

export type WeatherHorizon = "forecast" | "climate";
export interface WeatherQuery {
  location: { latitude: number; longitude: number };
  targetDate: string;
}
export interface WeatherResult {
  horizon: WeatherHorizon;
  targetDate: string;
  summary: string;
  observedAt: string;
  validUntil?: string;
  provider: string;
}
export interface WeatherPort {
  forecast(q: WeatherQuery): Promise<WeatherResult>;
}

// --- The gateway handed to agents (mock or real, decided once by A) ---------
export interface ToolGateway {
  maps: MapsPort;
  booking: BookingPort;
  weather?: WeatherPort;
}

// --- Memory port (implemented by @trip/services/memory) --------------------
export interface MemoryStore {
  getShortTerm(tripId: string): Promise<ChatTurn[]>;
  appendShortTerm(tripId: string, turn: ChatTurn): Promise<void>;
  getLongTerm(userId: string): Promise<UserPreference[]>;
  setLongTerm(userId: string, pref: UserPreference): Promise<void>;
  /** promote a confirmed short-term item into the long-term profile */
  promote(tripId: string, userId: string, key: string): Promise<void>;
}
