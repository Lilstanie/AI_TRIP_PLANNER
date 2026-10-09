import type { Coordinates, MapPlace } from "./types";

/*
 * Fixtures for the OpenStreetMap provider in mock data mode (`x-trip-data-mode: mock`). Nothing here
 * reaches a network: the OSRM client is answered by `mockOsrmFetch`, and the places a route or time
 * zone needs by `mockPlaceFor`. Durations are straight-line distance at a walking or driving pace, so
 * the same plan always shows the same legs.
 */

type FixturePlace = { name: string; address: string; location: Coordinates };

/** Kyoto places with OSM ids; the E2E scenario saves its stops from these. */
const PLACES: Record<string, FixturePlace> = {
  "osm:node/2001": {
    name: "Kyoto Station",
    address: "Higashishiokoji-cho, Shimogyo Ward, Kyoto",
    location: { latitude: 34.9858, longitude: 135.7588 },
  },
  "osm:way/2002": {
    name: "To-ji Temple",
    address: "Kujo-cho, Minami Ward, Kyoto",
    location: { latitude: 34.9805, longitude: 135.7478 },
  },
  "osm:relation/2003": {
    name: "Kiyomizu-dera",
    address: "Kiyomizu, Higashiyama Ward, Kyoto",
    location: { latitude: 34.9949, longitude: 135.785 },
  },
  "osm:node/2004": {
    name: "Nishiki Market",
    address: "Nishikikoji-dori, Nakagyo Ward, Kyoto",
    location: { latitude: 35.005, longitude: 135.7649 },
  },
};

/** The fixture place for an OSM id, or undefined when the fixtures do not know it. */
export function mockPlaceFor(id: string): MapPlace | undefined {
  const place = PLACES[id];
  if (!place) return undefined;
  return {
    id,
    source: "osm",
    osmUri: `https://www.openstreetmap.org/${id.slice(4)}`,
    primaryType: "tourist_attraction",
    ...(id === "osm:way/2002"
      ? {
          websiteUri: "https://toji.or.jp",
          phone: "+81 75 691 3325",
          openingHours: "Mo-Su 08:00-17:00",
          photos: [
            {
              name: "osm:fixture/Toji",
              authorAttributions: [{ displayName: "Fixture photographer" }],
              license: "CC BY-SA 4.0",
              licenseUri: "https://creativecommons.org/licenses/by-sa/4.0/",
            },
          ],
        }
      : {}),
    displayName: { text: place.name },
    formattedAddress: place.address,
    location: place.location,
  };
}

const WALK_METRES_PER_SECOND = 1.3;
const DRIVE_METRES_PER_SECOND = 6.7;
const DRIVE_OVERHEAD_SECONDS = 60;

function metresBetween(a: Coordinates, b: Coordinates) {
  const radius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

/** Google's polyline algorithm at precision 5, which is what OSRM's `geometries=polyline` uses. */
function encodePolyline(points: Coordinates[]) {
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = "";
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return out + String.fromCharCode(v + 63);
  };
  let previousLat = 0;
  let previousLon = 0;
  let out = "";
  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lon = Math.round(point.longitude * 1e5);
    out += encodeValue(lat - previousLat) + encodeValue(lon - previousLon);
    previousLat = lat;
    previousLon = lon;
  }
  return out;
}

/**
 * Answers an OSRM route request (`/route/v1/{profile}/{lon,lat};{lon,lat}`) from the fixtures. The
 * profile is `foot` or `driving`; anything else is an error, as OSRM would answer.
 */
export async function mockOsrmFetch(input: string): Promise<Response> {
  const url = new URL(input);
  const parts = url.pathname.split("/");
  const profile = parts[parts.indexOf("v1") + 1];
  const [from, to] = (parts.at(-1) ?? "").split(";").map((pair) => {
    const [longitude, latitude] = pair.split(",").map(Number);
    return { latitude: latitude!, longitude: longitude! };
  });
  if (!from || !to || !Number.isFinite(from.latitude) || !Number.isFinite(to.latitude))
    return Response.json({ code: "InvalidQuery" }, { status: 400 });
  const distance = metresBetween(from, to);
  if (profile === "foot") {
    const seconds = distance / WALK_METRES_PER_SECOND;
    return Response.json({
      code: "Ok",
      routes: [{ duration: seconds, distance, geometry: encodePolyline([from, to]) }],
    });
  }
  if (profile === "driving") {
    const seconds = DRIVE_OVERHEAD_SECONDS + distance / DRIVE_METRES_PER_SECOND;
    return Response.json({
      code: "Ok",
      routes: [{ duration: seconds, distance, geometry: encodePolyline([from, to]) }],
    });
  }
  return Response.json({ code: "InvalidQuery" }, { status: 400 });
}

/** A fixed place search, including the destination, with no upstream calls. */
export function mockSearchPlaces(text: string): MapPlace[] {
  const query = text.toLowerCase().trim();
  if (/unknown|unfindable|not-a-place/.test(query)) return [];
  const matches = Object.entries(PLACES).filter(
    ([, p]) => query.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(query),
  );
  if (matches.length) return matches.map(([id]) => mockPlaceFor(id)!);
  if (/kyoto|京都/.test(query)) return [mockPlaceFor("osm:node/2001")!];
  return [];
}
export async function mockTransitFetch(input: string): Promise<Response> {
  const url = new URL(input);
  const to = url.searchParams.get("toPlace") || "";
  return Response.json({
    itineraries: to.startsWith("0,") ? [] : [{ duration: 1200, legs: [{ mode: "BUS" }] }],
  });
}
