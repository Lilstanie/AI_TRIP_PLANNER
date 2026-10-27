import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/locale";

export const SHOW_DISTANCES_KEY = "trip.show-distances.v1";

export function formatDistance(meters: number | undefined, locale: AppLocale = "en") {
  if (meters === undefined || !Number.isFinite(meters) || meters <= 0) return undefined;
  if (meters < 1000) return translate(locale, "{v0} m", { v0: Math.round(meters) });
  const km = meters / 1000;
  return translate(locale, "{v0} km", { v0: km < 10 ? km.toFixed(1) : Math.round(km) });
}

type Endpoint = {
  name?: string;
  placeId?: string;
  location?: { latitude: number; longitude: number };
};

const point = ({ location, name }: Endpoint) =>
  location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? `${location.latitude},${location.longitude}`
    : name?.trim() || undefined;

export function samePlace(from: Endpoint, to: Endpoint) {
  if (from.placeId && to.placeId) return from.placeId === to.placeId;
  const left = from.name?.trim().toLowerCase();
  return !!left && left === to.name?.trim().toLowerCase();
}

export function directionsUrl(from: Endpoint, to: Endpoint) {
  const origin = point(from);
  const destination = point(to);
  if (!origin || !destination || samePlace(from, to)) return undefined;
  const query = new URLSearchParams({ api: "1", origin, destination });
  return `https://www.google.com/maps/dir/?${query}`;
}
