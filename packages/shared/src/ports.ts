import type { ChatTurn, FlightLeg, TravelMode, UserPreference } from "./contracts";

export type { TravelMode };

export interface GeoPoint {
  latitude: number;
  longitude: number;
}
export interface RouteQuery {
  from: string;
  to: string;

  fromLocation?: GeoPoint;
  toLocation?: GeoPoint;
  date?: string;

  departureTime?: string;

  localTime?: string;

  intercity?: boolean;

  passengers?: number;
}
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
  location?: GeoPoint;

  website?: string;
}
export interface ProviderProvenance {
  kind: "live" | "estimated" | "mock";
  provider: string;
  queriedAt?: string;
  fallbackFrom?: string;
  fallbackReason?: string;
}

export interface RouteOption {
  mode: TravelMode;
  durationMin: number;
  distanceMeters?: number;

  price: number;

  priceBasis: "complete" | "partial" | "unavailable";
  note?: string;
}
export interface MapsPort {
  route(q: RouteQuery): Promise<RouteLeg[]>;
  places(q: PlaceQuery): Promise<Place[]>;

  routeOptions?(q: RouteQuery): Promise<RouteOption[]>;
}

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

  grounded?: boolean;

  location?: { latitude: number; longitude: number };

  detailsUrl?: string;

  provenance?: ProviderProvenance;

  outbound?: FlightLeg;
  inbound?: FlightLeg;
  roundTrip?: boolean;

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

  stops?: number;

  durationMin?: number;

  provenance?: ProviderProvenance;

  outbound?: FlightLeg;
  inbound?: FlightLeg;
  roundTrip?: boolean;

  returnToken?: string;
}
export interface BookingPort {
  searchStays(q: StayQuery): Promise<StayOption[]>;
  searchFlights(q: FlightQuery): Promise<FlightOption[]>;

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

export interface ToolGateway {
  maps: MapsPort;
  booking: BookingPort;
  weather?: WeatherPort;
}

export interface MemoryStore {
  getShortTerm(tripId: string): Promise<ChatTurn[]>;
  appendShortTerm(tripId: string, turn: ChatTurn): Promise<void>;
  getLongTerm(userId: string): Promise<UserPreference[]>;
  setLongTerm(userId: string, pref: UserPreference): Promise<void>;

  promote(tripId: string, userId: string, key: string): Promise<void>;
}
