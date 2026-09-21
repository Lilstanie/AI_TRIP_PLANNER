// Shared Places API (New) "searchText" caller.
//
// Three different call sites in this package need the exact same request
// (POST places:searchText with an api-key header and a field mask): grounding
// attractions/restaurants for dining and destination-guide, resolving a city's
// coordinates for the transit timezone lookup, and — as of this feature —
// grounding hotel candidates for accommodation. Before this file, that request
// was implemented three times with small drifts between copies (see
// .agents/session-logs/2026-09-20-claude-google-maps-tests.md for the sibling
// duplicate found in apps/web/lib/google.ts). One implementation here removes
// that drift risk for the two call sites that live in this package.
export interface RawGooglePlace {
  displayName?: { text?: string };
  /** Google's native place-rating scale is 1.0–5.0, NOT this project's 0-10
   *  convention (see packages/agents/src/accommodation/planning.ts). Callers
   *  that feed this into a 0-10 field (StayCandidate.rating) must convert it
   *  themselves — this module returns the raw provider value unchanged. */
  rating?: number;
  priceLevel?:
    | "PRICE_LEVEL_UNSPECIFIED"
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
}

export async function searchGooglePlacesText(
  textQuery: string,
  fieldMask: string,
  pageSize = 5,
): Promise<RawGooglePlace[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.MAPS_API_KEY!,
      "x-goog-fieldmask": fieldMask,
    },
    body: JSON.stringify({ textQuery, pageSize }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  const data = (await response.json()) as { places?: RawGooglePlace[] };
  return data.places ?? [];
}
