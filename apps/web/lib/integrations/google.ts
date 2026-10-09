import { z } from "zod";
import { errorNotice, NoticeError, type Notice } from "@/lib/i18n/notice";

export const PlaceDetails = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  location: z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .optional(),
  googleMapsUri: z.string().url().optional(),
  source: z.enum(["google", "osm"]).optional(),
  osmUri: z.string().url().optional(),
  websiteUri: z.string().url().optional(),
  phone: z.string().optional(),
  openingHours: z.string().optional(),
  wikidata: z.string().optional(),
  commonsFile: z.string().optional(),
  rating: z.number().optional(),
  /** Google's main type for the place, such as `museum`; picks the icon on its map label. */
  primaryType: z.string().optional(),
  attributions: z
    .array(z.object({ provider: z.string().optional(), providerUri: z.string().optional() }))
    .optional(),
  /**
   * Google's photo names for this place. Google forbids caching them and they expire, so they
   * live only in memory beside the rest of the lookup and are never written into a plan.
   */
  photos: z
    .array(
      z.object({
        name: z.string().min(1),
        license: z.string().optional(),
        licenseUri: z.string().url().optional(),
        widthPx: z.number().optional(),
        heightPx: z.number().optional(),
        authorAttributions: z
          .array(z.object({ displayName: z.string().optional(), uri: z.string().optional() }))
          .optional(),
      }),
    )
    .optional(),
});
export type GooglePlace = z.infer<typeof PlaceDetails>;
export type GooglePlacePhoto = NonNullable<GooglePlace["photos"]>[number];
// `photos` and `primaryType` sit in a lower billing tier than `rating`, so asking for them does not
// raise the cost of a lookup; only fetching an image (placePhotoUri) is billed on its own.
const fields =
  "id,displayName,formattedAddress,location,googleMapsUri,rating,primaryType,attributions,photos";
/**
 * The deployment has no key, so every call will fail the same way until an
 * operator adds one. Separate from `GoogleRequestError` because a route that
 * cannot tell them apart offers the traveller a retry that can never succeed.
 */
export class GoogleNotConfiguredError extends NoticeError {
  constructor() {
    super({ key: "Google Maps is not configured. Add the server MAPS_API_KEY." });
    this.name = "GoogleNotConfiguredError";
  }
}
function key() {
  if (!process.env.MAPS_API_KEY) throw new GoogleNotConfiguredError();
  return process.env.MAPS_API_KEY;
}
/**
 * An upstream Google failure. `status` lets routes tell rate limits from other errors; `reason` is
 * Google's own reason when it gave one (`API_KEY_INVALID`, `REQUEST_DENIED`), so the map provider can
 * tell a refused key from a bad request. `notice` replaces the generic message where a caller already
 * had a more specific one.
 */
export class GoogleRequestError extends NoticeError {
  constructor(
    readonly status: number,
    readonly reason?: string,
    notice?: Notice,
  ) {
    super(notice ?? { key: "Google request failed ({status}). Please retry.", params: { status } });
    this.name = "GoogleRequestError";
  }
}

/** Google's reason for a failed request, from `error.details[].reason` or `error.status`. */
async function failureReason(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      error?: { status?: unknown; details?: { reason?: unknown }[] };
    };
    const detail = body.error?.details?.find((item) => typeof item?.reason === "string")?.reason;
    if (typeof detail === "string") return detail;
    return typeof body.error?.status === "string" ? body.error.status : undefined;
  } catch {
    return undefined;
  }
}

/** What a places route tells the traveller when Google failed: busy on a 429, else unavailable. */
export const placesUnavailable = (status: number | undefined): Notice =>
  status === 429
    ? { key: "Google Places is busy. Please retry shortly." }
    : { key: "Google Places is temporarily unavailable. Please retry." };
async function request(url: string, mask?: string, body?: unknown) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key(),
      ...(mask ? { "X-Goog-FieldMask": mask } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new GoogleRequestError(response.status, await failureReason(response));
  return response.json();
}
/** Search by a place name, optionally narrowed to a destination ("To-ji Temple" + "Kyoto"). */
export async function searchPlaces(text: string, destination?: string) {
  const data = await request(
    "https://places.googleapis.com/v1/places:searchText",
    fields
      .split(",")
      .map((f) => `places.${f}`)
      .join(","),
    { textQuery: destination ? `${text} ${destination}` : text, pageSize: 5 },
  );
  return z.array(PlaceDetails).parse(data.places ?? []);
}
export async function placeDetails(id: string) {
  return PlaceDetails.parse(
    await request(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, fields),
  );
}
/** `places/{placeId}/photos/{photoId}`, as Places returns it; anything else is refused. */
export const PHOTO_NAME = /^places\/[A-Za-z0-9_-]{1,300}\/photos\/[A-Za-z0-9_-]{1,2048}$/;
export const PHOTO_WIDTHS = [160, 400, 800] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

/**
 * A short-lived image URL for one place photo. Each call is billed by Google, so callers fetch it
 * only for a photo someone is looking at. The key stays on the server: the browser only ever sees
 * the returned googleusercontent URL.
 */
export async function placePhotoUri(name: string, maxWidthPx: PhotoWidth) {
  if (!PHOTO_NAME.test(name)) throw new GoogleRequestError(400);
  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.search = new URLSearchParams({
    maxWidthPx: String(maxWidthPx),
    skipHttpRedirect: "true",
  }).toString();
  const data = await request(url.toString());
  const photoUri = typeof data?.photoUri === "string" ? data.photoUri : "";
  let parsed: URL | undefined;
  try {
    parsed = new URL(photoUri);
  } catch {
    parsed = undefined;
  }
  // Only ever redirect the browser to Google's own image host.
  if (parsed?.protocol !== "https:" || !parsed.hostname.endsWith(".googleusercontent.com"))
    throw new GoogleRequestError(502);
  return parsed.toString();
}
const TIME_ZONE_FAILURES: Record<string, number> = {
  REQUEST_DENIED: 403,
  OVER_QUERY_LIMIT: 429,
  OVER_DAILY_LIMIT: 429,
  UNKNOWN_ERROR: 500,
};
export async function timeZone(place: GooglePlace, date: string) {
  if (!place.location) throw new NoticeError({ key: "This place has no verified coordinates." });
  const { latitude, longitude } = place.location;
  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.search = new URLSearchParams({
    location: `${latitude},${longitude}`,
    timestamp: String(Date.parse(`${date}T12:00:00Z`) / 1000),
    key: key(),
  }).toString();
  const data = await request(url.toString());
  // The Time Zone API reports a refused key or an exhausted quota as a 200 with a status, so name
  // those as the HTTP failures they are; the traveller still reads the same sentence.
  const unverified = { key: "Destination time zone could not be verified." } as const;
  const failed = TIME_ZONE_FAILURES[data.status as string];
  if (failed) throw new GoogleRequestError(failed, data.status, unverified);
  if (data.status !== "OK" || typeof data.timeZoneId !== "string")
    throw new NoticeError(unverified);
  return data.timeZoneId as string;
}
/** Enumerate possible offsets: reject ambiguous/nonexistent local times at DST transitions. */
export function localInstant(date: string, time: string, zone: string) {
  const target = `${date}T${time}`;
  const naive = Date.parse(`${target}:00Z`);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = naive - offset * 60000;
    if (formatter.format(new Date(instant)).replace(" ", "T") === target) matches.push(instant);
  }
  if (matches.length !== 1)
    throw new NoticeError({
      key: "Local time is ambiguous or nonexistent due to daylight saving. Choose another time.",
    });
  return new Date(matches[0]!).toISOString();
}
/** A route request's travel mode, as the Routes API names it. */
export type RouteMode = "WALK" | "TRANSIT" | "DRIVE";

/**
 * One leg as the provider answered it. `ok`: a route with its duration. `no_route`: the provider
 * answered without a route between the two places, which is a fact about the leg. `unavailable`: the
 * provider could not answer (an HTTP error, a network failure, a missing key), so nothing is known.
 */
export type RouteResult = {
  from: string;
  to: string;
  mode: RouteMode;
  status: "ok" | "no_route" | "unavailable";
  durationMin?: number;
  distanceMeters?: number;
  polyline?: string;
  fare?: { amount: number; currency: string };
  /** Why the route is unavailable, in English for logs and the planner. */
  error?: string;
  /** The same reason as a notice for the traveller; absent on routes saved before it existed. */
  notice?: Notice;
  /** A fixture from simulated mode, never a provider answer. */
  simulated?: true;
  /**
   * The service that answered: Google, or OSRM for walking and driving on the free fallback (ticket
   * #276 adds Transitous). Absent on routes saved before it existed.
   */
  source?: "google" | "osrm" | "transitous";
};

/** A route nobody could answer, with the reason as an English error and a notice. */
export function unavailableRoute(
  base: Pick<RouteResult, "from" | "to" | "mode">,
  error: unknown,
): RouteResult {
  return {
    ...base,
    status: "unavailable",
    error: error instanceof Error ? error.message : "Route unavailable",
    notice: errorNotice(error, { key: "Route unavailable" }),
  };
}
/** A leg between two Google places. Throws when Google could not answer; see `googleRoute`. */
export async function requestGoogleRoute(
  from: string,
  to: string,
  departure: string,
  mode: RouteMode,
): Promise<RouteResult> {
  const base = { from, to, mode };
  const delta = Date.parse(departure) - Date.now();
  if (mode === "TRANSIT" && (delta < -7 * 86400000 || delta > 100 * 86400000))
    throw new NoticeError({
      key: "Transit departure is outside Google's supported date window.",
    });
  const data = await request(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    "routes.duration,routes.polyline.encodedPolyline,routes.travelAdvisory.transitFare",
    {
      origin: { placeId: from },
      destination: { placeId: to },
      travelMode: mode,
      ...(mode === "TRANSIT" ? { departureTime: departure } : {}),
    },
  );
  // An answer with no route is a fact about this leg, not a failed request.
  if (!data.routes?.length) return { ...base, status: "no_route" };
  const route = data.routes[0];
  if (!/^\d+(\.\d+)?s$/.test(route.duration))
    throw new NoticeError({ key: "No verified route was returned." });
  const durationMin = Math.ceil(Number(route.duration.slice(0, -1)) / 60);
  if (!Number.isFinite(durationMin) || durationMin <= 0)
    throw new NoticeError({ key: "Invalid route duration." });
  const fare = route.travelAdvisory?.transitFare;
  const amount = Number(fare?.units ?? 0) + Number(fare?.nanos ?? 0) / 1e9;
  return {
    ...base,
    status: "ok",
    durationMin,
    polyline: route.polyline?.encodedPolyline,
    ...(fare?.currencyCode && Number.isFinite(amount) && amount >= 0
      ? { fare: { amount, currency: fare.currencyCode } }
      : {}),
  };
}

/** A leg between two Google places; any failure comes back as an `unavailable` route. */
export async function googleRoute(
  from: string,
  to: string,
  departure: string,
  mode: RouteMode,
): Promise<RouteResult> {
  try {
    return await requestGoogleRoute(from, to, departure, mode);
  } catch (error) {
    return unavailableRoute({ from, to, mode }, error);
  }
}

/**
 * User-triggered route lookup. Coordinates are used only for this request and are never stored.
 * Throws when Google could not answer; see `googleRouteFromCoordinates`.
 */
export async function requestGoogleRouteFromCoordinates(
  origin: { latitude: number; longitude: number },
  to: string,
  mode: "WALK" | "TRANSIT",
): Promise<RouteResult> {
  const base = { from: "current-location", to, mode } as const;
  const data = await request(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    "routes.duration,routes.distanceMeters,routes.travelAdvisory.transitFare",
    {
      origin: { location: { latLng: origin } },
      destination: { placeId: to },
      travelMode: mode,
      ...(mode === "TRANSIT" ? { departureTime: new Date().toISOString() } : {}),
    },
  );
  const route = data.routes?.[0];
  if (!route || !/^\d+(\.\d+)?s$/.test(route.duration))
    throw new NoticeError({ key: "No verified route was returned." });
  const durationMin = Math.ceil(Number(route.duration.slice(0, -1)) / 60);
  const distanceMeters = Number(route.distanceMeters);
  if (!Number.isFinite(durationMin) || durationMin <= 0)
    throw new NoticeError({ key: "Invalid route duration." });
  const fare = route.travelAdvisory?.transitFare;
  const amount = Number(fare?.units ?? 0) + Number(fare?.nanos ?? 0) / 1e9;
  return {
    ...base,
    status: "ok",
    durationMin,
    ...(Number.isFinite(distanceMeters) && distanceMeters >= 0 ? { distanceMeters } : {}),
    ...(fare?.currencyCode && Number.isFinite(amount) && amount >= 0
      ? { fare: { amount, currency: fare.currencyCode } }
      : {}),
  };
}

/** The route from the traveller's position; any failure comes back as an `unavailable` route. */
export async function googleRouteFromCoordinates(
  origin: { latitude: number; longitude: number },
  to: string,
  mode: "WALK" | "TRANSIT",
): Promise<RouteResult> {
  try {
    return await requestGoogleRouteFromCoordinates(origin, to, mode);
  } catch (error) {
    return unavailableRoute({ from: "current-location", to, mode }, error);
  }
}
