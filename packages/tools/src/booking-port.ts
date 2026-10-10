import type {
  BookingPort,
  StayQuery,
  StayOption,
  FlightQuery,
  FlightOption,
  FlightLeg,
} from "@trip/shared";
import { searchGooglePlacesText } from "./google-places";
import {
  searchFlightsSerpApi,
  searchHotelsSerpApi,
  searchReturnLegSerpApi,
  SerpApiError,
} from "./serpapi";
import { toolNow, type ToolRuntimeConfig } from "./runtime-context";

function normalizedRating(googleRating: number | undefined): number {
  if (!Number.isFinite(googleRating)) return 0;
  return Math.round(googleRating! * 2 * 10) / 10;
}

const PRICE_LEVEL_ESTIMATE_AUD: Partial<Record<string, number>> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 135,
  PRICE_LEVEL_MODERATE: 225,
  PRICE_LEVEL_EXPENSIVE: 390,
  PRICE_LEVEL_VERY_EXPENSIVE: 630,
};
function estimatedNightlyRate(priceLevel: string | undefined): number {
  return (
    PRICE_LEVEL_ESTIMATE_AUD[priceLevel ?? ""] ?? PRICE_LEVEL_ESTIMATE_AUD.PRICE_LEVEL_MODERATE!
  );
}

const NIGHTLY_RATES = new Map<string, [number, number, number]>([
  ["tokyo", [240, 380, 520]],
  ["kyoto", [220, 360, 490]],
  ["sydney", [150, 230, 330]],
  ["paris", [160, 250, 360]],
]);

function dateValue(date: string): number {
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Booking requires a valid YYYY-MM-DD date: ${date}`);
  }
  return value;
}

function requireCount(count: number): void {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("Booking requires a positive integer guest/passenger count.");
  }
}

function validatedStayCity(q: StayQuery): string {
  requireCount(q.guests);
  if (dateValue(q.checkOut) <= dateValue(q.checkIn)) {
    throw new Error("Check-out must be after check-in.");
  }
  const city = q.city.trim();
  if (!city) throw new Error("A city is required for a stay search.");
  return city;
}

async function searchFixtureStays(q: StayQuery): Promise<StayOption[]> {
  const city = validatedStayCity(q);
  const [economy, standard, comfort] = NIGHTLY_RATES.get(city.toLowerCase()) ?? [100, 180, 280];
  return [
    {
      name: `Mock ${city} Economy`,
      area: "Outer district",
      pricePerNight: economy,
      rating: 7.6,
      freeCancellation: true,
      provenance: { kind: "mock", provider: "Mock booking fixture" },
    },
    {
      name: `Mock ${city} Standard`,
      area: "Central",
      pricePerNight: standard,
      rating: 8.7,
      freeCancellation: true,
      provenance: { kind: "mock", provider: "Mock booking fixture" },
    },
    {
      name: `Mock ${city} Comfort`,
      area: "Central",
      pricePerNight: comfort,
      rating: 9.3,
      freeCancellation: true,
      provenance: { kind: "mock", provider: "Mock booking fixture" },
    },
    {
      name: `Mock ${city} Saver`,
      area: "Outer district",
      pricePerNight: economy - 20,
      rating: 7.2,
      freeCancellation: false,
      provenance: { kind: "mock", provider: "Mock booking fixture" },
    },
  ];
}

async function searchSerpApiStaysWithFallback(
  q: StayQuery,
  config: ToolRuntimeConfig,
): Promise<StayOption[]> {
  const city = validatedStayCity(q);
  try {
    return await searchHotelsSerpApi({
      city,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      guests: q.guests,
    });
  } catch (error) {
    const reason = error instanceof SerpApiError ? error.reason : "request_failed";
    console.warn(
      `[booking] SerpApi hotel search unavailable (${reason}); falling back to Google Places estimate: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return searchStaysGooglePlacesEstimate(city, config, {
      fallbackFrom: "SerpApi Google Hotels",
      fallbackReason: reason,
    });
  }
}

async function searchGoogleStays(q: StayQuery, config: ToolRuntimeConfig): Promise<StayOption[]> {
  return searchStaysGooglePlacesEstimate(validatedStayCity(q), config);
}

async function searchStaysGooglePlacesEstimate(
  city: string,
  config: ToolRuntimeConfig,
  fallback?: { fallbackFrom: string; fallbackReason: string },
): Promise<StayOption[]> {
  if (config.mapsProvider !== "google") {
    throw new Error(`Unsupported booking provider: ${config.mapsProvider}`);
  }
  if (!config.mapsApiKey) throw new Error("Google Places provider requires MAPS_API_KEY.");
  const results = await searchGooglePlacesText(
    `hotels in ${city}`,
    "places.displayName,places.rating,places.priceLevel,places.formattedAddress,places.websiteUri",
  );
  const queriedAt = toolNow().toISOString();
  const options: StayOption[] = results
    .map((place) => ({
      name: place.displayName?.text?.trim() ?? "",
      area: place.formattedAddress?.trim() || city,
      pricePerNight: estimatedNightlyRate(place.priceLevel),
      rating: normalizedRating(place.rating),

      freeCancellation: false,
      grounded: true,

      ...(place.websiteUri?.trim() ? { detailsUrl: place.websiteUri.trim() } : {}),
      provenance: {
        kind: "estimated" as const,
        provider: "Google Places estimate",
        queriedAt,
        ...fallback,
      },
    }))
    .filter((option) => option.name.length > 0);
  if (options.length === 0) throw new Error(`Google Places returned no lodging in ${city}.`);
  return options;
}

function validatedFlightQuery(q: FlightQuery): FlightQuery & { from: string; to: string } {
  requireCount(q.passengers);
  const departure = dateValue(q.depart);
  if (q.return !== undefined && dateValue(q.return) < departure) {
    throw new Error("Return date cannot precede departure.");
  }
  const from = q.from.trim();
  const to = q.to.trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
    throw new Error("Flight origin and destination must be distinct, non-empty locations.");
  }
  const legs = q.return === undefined ? 1 : 2;
  if (!Number.isSafeInteger(420 * q.passengers * legs * 100)) {
    throw new Error("Flight estimate exceeds supported AUD precision.");
  }
  return { ...q, from, to };
}

async function searchFixtureFlights(q: FlightQuery): Promise<FlightOption[]> {
  const validated = validatedFlightQuery(q);
  const legs = validated.return === undefined ? 1 : 2;
  const note =
    `${validated.from} ${legs === 2 ? "<->" : "->"} ${validated.to}; ${validated.passengers} passengers; ` +
    `${legs === 2 ? "round-trip" : "one-way"} group total in AUD; fictional mock fare`;
  return [
    {
      carrier: "MockAir Economy",
      price: 310 * validated.passengers * legs,
      note,
      provenance: { kind: "mock", provider: "Mock booking fixture" },
    },
    {
      carrier: "MockAir Flexible",
      price: 420 * validated.passengers * legs,
      note,
      provenance: { kind: "mock", provider: "Mock booking fixture" },
    },
  ];
}

async function searchSerpApiFlights(q: FlightQuery): Promise<FlightOption[]> {
  const validated = validatedFlightQuery(q);

  return searchFlightsSerpApi({
    from: validated.from,
    to: validated.to,
    depart: validated.depart,
    return: validated.return,
    passengers: validated.passengers,
  });
}

async function searchUnavailableFlights(q: FlightQuery): Promise<FlightOption[]> {
  validatedFlightQuery(q);
  throw new Error("Unsupported flight provider: no SERPAPI_KEY set.");
}

async function searchSerpApiReturnLeg(
  q: FlightQuery & { token: string },
): Promise<FlightLeg | undefined> {
  if (!q.return) return undefined;
  try {
    return await searchReturnLegSerpApi({
      from: q.from,
      to: q.to,
      depart: q.depart,
      return: q.return,
      passengers: q.passengers,
      token: q.token,
    });
  } catch (error) {
    if (error instanceof SerpApiError) return undefined;
    throw error;
  }
}

const noReturnLeg = async (): Promise<undefined> => undefined;

export function createBookingPort(config: ToolRuntimeConfig, reportSelection = false): BookingPort {
  if (config.dataMode === "mock") {
    return {
      searchStays: searchFixtureStays,
      searchFlights: searchFixtureFlights,
      searchReturnLeg: noReturnLeg,
    };
  }

  if (reportSelection) {
    const selection = config.serpApiKey
      ? "SerpApi (live prices; Google Places estimate on hotel failure)"
      : config.mapsProvider === "google" && config.mapsApiKey
        ? "Google Places (grounded properties, estimated hotel prices; flights unavailable)"
        : "unavailable until a configured capability is called";
    console.warn(`[tools] Live booking: ${selection}.`);
  }

  return {
    searchStays: config.serpApiKey
      ? (query) => searchSerpApiStaysWithFallback(query, config)
      : (query) => searchGoogleStays(query, config),
    searchFlights: config.serpApiKey ? searchSerpApiFlights : searchUnavailableFlights,
    searchReturnLeg: config.serpApiKey ? searchSerpApiReturnLeg : noReturnLeg,
  };
}
