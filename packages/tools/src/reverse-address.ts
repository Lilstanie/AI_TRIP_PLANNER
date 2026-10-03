import { TripAddress, type TripAddress as Address } from "@trip/shared";
import { nominatimRequest, NominatimError } from "./nominatim";
import { toolRuntimeConfig } from "./runtime-context";
/** Explicit browser-location lookups are live even when trip planning uses mock fixtures. */
export async function reverseAddress(
  latitude: number,
  longitude: number,
  language: string,
): Promise<Address> {
  const base = toolRuntimeConfig().nominatimBaseUrl;
  // City/suburb granularity, never house numbers or street addresses.
  const url = new URL(`${base.replace(/\/$/, "")}/reverse`);
  url.search = new URLSearchParams({
    lat: latitude.toFixed(3),
    lon: longitude.toFixed(3),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "13",
    "accept-language": language,
  }).toString();
  const data = await nominatimRequest<{ address?: Record<string, unknown> }>(url.toString());
  const fields = data.address ?? {};
  const text = (...keys: string[]) =>
    keys.map((key) => fields[key]).find((item) => typeof item === "string" && item.trim()) ?? "";
  const parsed = TripAddress.safeParse({
    suburb: text("suburb", "neighbourhood"),
    city: text("city", "town", "village", "municipality"),
    state: text("state", "province"),
    country: text("country"),
  });
  if (!parsed.success) throw new NominatimError("unavailable");
  return parsed.data;
}
