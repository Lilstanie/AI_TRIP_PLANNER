// Ports — the interfaces the Orchestrator injects into every agent via
// AgentContext. @trip/tools and @trip/services implement these; agents depend
// only on the interface, so they stay testable (pass a fake in a unit test).
// Owner: A.

import type { ChatTurn, UserPreference } from "./contracts";
import type { Coordinates, GeoJsonPosition } from "./map";

// --- Maps / Places port (implemented by @trip/tools/maps) -------------------
export interface RouteQuery {
  from: string;
  to: string;
  date?: string;
  fromCoordinates?: Coordinates;
  toCoordinates?: Coordinates;
}
export interface RouteLeg {
  mode: "train" | "flight" | "bus" | "walk" | "transit";
  durationMin: number;
  priceUsd: number;
  note?: string;
  from?: Coordinates;
  to?: Coordinates;
  geometry?: GeoJsonPosition[];
  distanceKm?: number;
}
export interface PlaceQuery {
  near: string;
  category?: string;
}
export interface Place {
  name: string;
  category: string;
  rating?: number;
  id?: string;
  coordinates?: Coordinates;
}
export interface GeocodeQuery {
  query: string;
  near?: string;
}
export interface GeocodedPlace extends Place {
  id: string;
  coordinates: Coordinates;
}
export interface MapsPort {
  route(q: RouteQuery): Promise<RouteLeg[]>;
  places(q: PlaceQuery): Promise<Place[]>;
  /** Optional during migration so existing injected fakes remain compatible. */
  geocode?(q: GeocodeQuery): Promise<GeocodedPlace | null>;
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
  pricePerNightUsd: number;
  rating: number;
  freeCancellation: boolean;
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
  priceUsd: number;
  note?: string;
}
export interface BookingPort {
  searchStays(q: StayQuery): Promise<StayOption[]>;
  searchFlights(q: FlightQuery): Promise<FlightOption[]>;
}

// --- The gateway handed to agents (mock or real, decided once by A) ---------
export interface ToolGateway {
  maps: MapsPort;
  booking: BookingPort;
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
