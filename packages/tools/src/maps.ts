// Owner: B — deterministic Maps / Places adapter. These fixtures let the UI
// exercise a real geographic pipeline without claiming live provider data.
import type {
  Coordinates,
  GeocodeQuery,
  GeocodedPlace,
  Place,
  PlaceQuery,
  RouteLeg,
  RouteQuery,
} from "@trip/shared";

export type {
  GeocodeQuery,
  GeocodedPlace,
  Place,
  PlaceQuery,
  RouteLeg,
  RouteQuery,
} from "@trip/shared";

type Fixture = GeocodedPlace & { aliases?: string[] };

const FIXTURES: Fixture[] = [
  {
    id: "sydney",
    name: "Sydney",
    category: "city",
    coordinates: { latitude: -33.8688, longitude: 151.2093 },
    aliases: ["central sydney"],
  },
  {
    id: "sydney-airport",
    name: "Sydney Airport",
    category: "transport",
    coordinates: { latitude: -33.9399, longitude: 151.1753 },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    category: "city",
    coordinates: { latitude: 35.6762, longitude: 139.6503 },
    aliases: ["central tokyo"],
  },
  {
    id: "tokyo-station",
    name: "Tokyo Station",
    category: "transport",
    coordinates: { latitude: 35.6812, longitude: 139.7671 },
  },
  {
    id: "sensoji",
    name: "Sensō-ji",
    category: "sight",
    rating: 4.6,
    coordinates: { latitude: 35.7148, longitude: 139.7967 },
    aliases: ["senso-ji", "sensoji"],
  },
  {
    id: "meiji-shrine",
    name: "Meiji Shrine",
    category: "sight",
    rating: 4.6,
    coordinates: { latitude: 35.6764, longitude: 139.6993 },
  },
  {
    id: "shibuya",
    name: "Shibuya",
    category: "neighborhood",
    rating: 4.5,
    coordinates: { latitude: 35.6595, longitude: 139.7005 },
    aliases: ["shibuya crossing"],
  },
  {
    id: "asakusa",
    name: "Asakusa",
    category: "neighborhood",
    rating: 4.5,
    coordinates: { latitude: 35.7147, longitude: 139.7966 },
  },
  {
    id: "kyoto",
    name: "Kyoto",
    category: "city",
    coordinates: { latitude: 35.0116, longitude: 135.7681 },
    aliases: ["central kyoto"],
  },
  {
    id: "kyoto-station",
    name: "Kyoto Station",
    category: "transport",
    coordinates: { latitude: 34.9858, longitude: 135.7588 },
  },
  {
    id: "fushimi-inari",
    name: "Fushimi Inari Taisha",
    category: "sight",
    rating: 4.7,
    coordinates: { latitude: 34.9671, longitude: 135.7727 },
    aliases: ["fushimi inari"],
  },
  {
    id: "kiyomizudera",
    name: "Kiyomizu-dera",
    category: "sight",
    rating: 4.6,
    coordinates: { latitude: 34.9949, longitude: 135.785 },
    aliases: ["kiyomizu dera"],
  },
  {
    id: "gion",
    name: "Gion",
    category: "neighborhood",
    rating: 4.6,
    coordinates: { latitude: 35.0037, longitude: 135.7788 },
  },
  {
    id: "arashiyama",
    name: "Arashiyama",
    category: "neighborhood",
    rating: 4.6,
    coordinates: { latitude: 35.0094, longitude: 135.6668 },
  },
  {
    id: "paris",
    name: "Paris",
    category: "city",
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
    aliases: ["central paris"],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findFixture(query: string): Fixture | undefined {
  const normalized = normalize(query);
  if (!normalized) return undefined;
  const candidates = FIXTURES.flatMap((fixture) =>
    [fixture.name, fixture.id, ...(fixture.aliases ?? [])].map((candidate) => ({
      fixture,
      key: normalize(candidate),
    })),
  );
  return (
    candidates.find(({ key }) => normalized === key)?.fixture ??
    candidates
      .filter(({ key }) => normalized.includes(key))
      .sort((left, right) => right.key.length - left.key.length)[0]?.fixture
  );
}

function copyPlace(fixture: Fixture): GeocodedPlace {
  return {
    id: fixture.id,
    name: fixture.name,
    category: fixture.category,
    rating: fixture.rating,
    coordinates: { ...fixture.coordinates },
  };
}

export async function geocode(q: GeocodeQuery): Promise<GeocodedPlace | null> {
  // Mock hotels are fictional. Anchor them explicitly to their fixture city,
  // and keep the name so the map does not imply a real street-level location.
  if (/^mock\s/i.test(q.query)) {
    const city = findFixture(q.query) ?? findFixture(q.near ?? "");
    if (city) {
      return {
        id: `mock-${normalize(q.query).replace(/\s/g, "-")}`,
        name: q.query.split(",")[0]!.trim(),
        category: "hotel",
        coordinates: { ...city.coordinates },
      };
    }
  }
  const direct = findFixture(q.query);
  if (direct) return copyPlace(direct);
  return null;
}

function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLng = radians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export async function route(q: RouteQuery): Promise<RouteLeg[]> {
  const from = q.fromCoordinates ?? (await geocode({ query: q.from }))?.coordinates;
  const to = q.toCoordinates ?? (await geocode({ query: q.to }))?.coordinates;
  const distance = from && to ? distanceKm(from, to) : undefined;
  const longDistance = (distance ?? 0) > 400;
  const mode: RouteLeg["mode"] = longDistance ? "flight" : "train";
  return [
    {
      mode,
      durationMin:
        distance === undefined
          ? 140
          : Math.max(15, Math.round(distance / (longDistance ? 10 : 2.6))),
      priceUsd: longDistance ? 240 : 90,
      note: `mock ${q.from} -> ${q.to}`,
      from,
      to,
      geometry:
        from && to
          ? [
              [from.longitude, from.latitude],
              [to.longitude, to.latitude],
            ]
          : undefined,
      distanceKm: distance,
    },
  ];
}

export async function places(q: PlaceQuery): Promise<Place[]> {
  const cities = q.near
    .split("&")
    .map((value) => findFixture(value.trim()))
    .filter((value): value is Fixture => Boolean(value));
  const category = q.category ?? "sight";
  const matches = FIXTURES.filter((fixture) => {
    if (fixture.category !== category) return false;
    return cities.some((city) => {
      const km = distanceKm(city.coordinates, fixture.coordinates);
      return km < 100;
    });
  });
  return matches.length
    ? matches.map(copyPlace)
    : [{ name: `Central ${q.near}`, category, rating: 4.5 }];
}
