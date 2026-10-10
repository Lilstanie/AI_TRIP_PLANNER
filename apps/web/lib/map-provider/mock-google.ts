import { NoticeError } from "@/lib/i18n/notice";
import { mockSearchPlaces, mockPlaceFor } from "./mock-osm";
import { osmMapProvider } from "./osm";
import type { MapPlace, MapProvider } from "./types";
const toOsm = (id: string) => id.replace(/^mock-google-/, "osm:");
const googlePlace = (p: MapPlace): MapPlace => ({
  ...p,
  id: p.id.replace(/^osm:/, "mock-google-"),
  source: "google",
  osmUri: undefined,
  photos: undefined,
});

export function mockGoogleProvider(): MapProvider {
  const osm = osmMapProvider({ dataMode: "mock" });
  return {
    searchPlaces: async ({ text }) => ({
      value: mockSearchPlaces(text).map(googlePlace),
      source: "google",
    }),
    placeDetails: async (id) => {
      const place = mockPlaceFor(toOsm(id));
      if (!place) throw new NoticeError({ key: "This saved place is no longer available." });
      return { value: googlePlace(place), source: "google" };
    },
    placePhoto: async () => {
      throw new NoticeError({ key: "Unknown photo." });
    },
    route: async (from, to, departure, mode, hints) => ({
      ...(await osm.route(toOsm(from), toOsm(to), departure, mode, hints)),
      from,
      to,
      source: "google",
      simulated: true,
    }),
    routeFromLocation: async (origin, to, mode) => ({
      ...(await osm.routeFromLocation(origin, toOsm(to), mode)),
      to,
      source: "google",
      simulated: true,
    }),
    timeZone: async (place, date) => ({ ...(await osm.timeZone(place, date)), source: "google" }),
  };
}
