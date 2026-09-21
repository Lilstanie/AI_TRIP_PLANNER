import type { RouteOption, RouteQuery, TravelMode } from "@trip/shared";

/**
 * Ways to make one hop, compared side by side: drive, or take what runs.
 *
 * Google reports these separately, and honestly: for an Australian journey it
 * returns real road tolls in AUD but an empty `transitFare`, so a bus fare is
 * genuinely unknown here rather than free. Every option therefore carries a
 * `priceBasis` saying how much of its cost is actually known — a $0 bus and a
 * $0 toll-free drive mean very different things, and flattening them would
 * quietly make public transport look like the cheapest option every time.
 */

/** Google's transit vehicle types, mapped onto this project's vocabulary. */
const VEHICLES: Record<string, TravelMode> = {
  BUS: "bus",
  INTERCITY_BUS: "bus",
  TROLLEYBUS: "bus",
  HEAVY_RAIL: "train",
  COMMUTER_TRAIN: "train",
  HIGH_SPEED_TRAIN: "train",
  LONG_DISTANCE_TRAIN: "train",
  METRO_RAIL: "train",
  SUBWAY: "train",
  MONORAIL: "train",
  RAIL: "train",
  TRAM: "tram",
  FERRY: "ferry",
};

interface TransitStep {
  travelMode?: string;
  transitDetails?: {
    transitLine?: { nameShort?: string; name?: string; vehicle?: { type?: string } };
  };
}
export interface GoogleRouteShape {
  duration?: string;
  distanceMeters?: number;
  travelAdvisory?: {
    tollInfo?: { estimatedPrice?: Array<{ currencyCode?: string; units?: string; nanos?: number }> };
    transitFare?: { currencyCode?: string; units?: string; nanos?: number };
  };
  legs?: Array<{ steps?: TransitStep[] }>;
}

/** Google money: units are whole currency, nanos the billionths beneath them. */
export function moneyFrom(
  amount: { currencyCode?: string; units?: string; nanos?: number } | undefined,
): number | undefined {
  if (!amount?.currencyCode) return undefined;
  const units = Number(amount.units ?? 0);
  const nanos = Number(amount.nanos ?? 0);
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return undefined;
  return Math.round((units + nanos / 1e9) * 100) / 100;
}

export function minutesFrom(duration: string | undefined): number | undefined {
  if (!duration || !/^\d+(?:\.\d+)?s$/.test(duration)) return undefined;
  const seconds = Number(duration.slice(0, -1));
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : undefined;
}

/** The vehicles a transit route actually uses, in order, without repeats. */
export function transitVehicles(route: GoogleRouteShape): { mode: TravelMode; line?: string }[] {
  const seen = new Set<string>();
  const found: { mode: TravelMode; line?: string }[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const line = step.transitDetails?.transitLine;
      const type = line?.vehicle?.type;
      if (!type) continue;
      const mode = VEHICLES[type] ?? "transit";
      const label = line?.nameShort ?? line?.name;
      const key = `${mode}:${label ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ mode, ...(label ? { line: label } : {}) });
    }
  }
  return found;
}

export function driveOption(route: GoogleRouteShape, q: RouteQuery): RouteOption | undefined {
  const durationMin = minutesFrom(route.duration);
  if (durationMin === undefined) return undefined;
  const tolls = route.travelAdvisory?.tollInfo?.estimatedPrice ?? [];
  // Only tolls quoted in the base currency can be added to a base-currency
  // total; a foreign-currency toll is reported in the note instead.
  const aud = tolls.filter((toll) => toll.currencyCode === "AUD");
  const price = aud.reduce((sum, toll) => sum + (moneyFrom(toll) ?? 0), 0);
  const km = route.distanceMeters ? Math.round(route.distanceMeters / 100) / 10 : undefined;
  const foreign = tolls.filter((toll) => toll.currencyCode && toll.currencyCode !== "AUD");
  return {
    mode: "drive",
    durationMin,
    ...(route.distanceMeters ? { distanceMeters: route.distanceMeters } : {}),
    price,
    // Fuel, parking and hire are not quoted by the provider, so even a route
    // with tolls has only part of its cost known.
    priceBasis: "partial",
    note: `Driving ${q.from} → ${q.to}${km ? `; ${km}km` : ""}; ${
      price ? `tolls A$${price.toFixed(2)}` : "no tolls on this route"
    }; fuel, parking and vehicle hire not included${
      foreign.length ? `; tolls also quoted in ${foreign[0]!.currencyCode}` : ""
    }.`,
  };
}

export function transitOption(route: GoogleRouteShape, q: RouteQuery): RouteOption | undefined {
  const durationMin = minutesFrom(route.duration);
  if (durationMin === undefined) return undefined;
  const vehicles = transitVehicles(route);
  const fare = moneyFrom(route.travelAdvisory?.transitFare);
  const described = vehicles
    .map((vehicle) => (vehicle.line ? `${vehicle.mode} ${vehicle.line}` : vehicle.mode))
    .join(", ");
  return {
    // A single-vehicle trip is named by its vehicle; a mixed one stays generic.
    mode: vehicles.length === 1 ? vehicles[0]!.mode : "transit",
    durationMin,
    ...(route.distanceMeters ? { distanceMeters: route.distanceMeters } : {}),
    price: fare ?? 0,
    priceBasis: fare === undefined ? "unavailable" : "complete",
    note: `Public transport ${q.from} → ${q.to}${described ? ` via ${described}` : ""}; ${
      fare === undefined ? "fare not published for this region" : `fare A$${fare.toFixed(2)}`
    }.`,
  };
}
