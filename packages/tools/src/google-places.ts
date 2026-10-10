import { toolFetch, toolRuntimeConfig } from "./runtime-context";

export interface RawGooglePlace {
  displayName?: { text?: string };

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

  websiteUri?: string;
}

export async function searchGooglePlacesText(
  textQuery: string,
  fieldMask: string,
  pageSize = 5,
): Promise<RawGooglePlace[]> {
  const response = await toolFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": toolRuntimeConfig().mapsApiKey!,
      "x-goog-fieldmask": fieldMask,
    },
    body: JSON.stringify({ textQuery, pageSize }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  const data = (await response.json()) as { places?: RawGooglePlace[] };
  return data.places ?? [];
}
