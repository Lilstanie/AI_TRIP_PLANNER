"use client";
import { loadMaps, type MapsSDK } from "./google-maps-sdk";

/** Both renderers expose the small map/layer/framing boundary, never a provider's full SDK. */
export type MapRenderer = { maps: MapsSDK; provider: "google" | "osm" };
export async function loadRenderer(forceOsm = false, allowFallback = true): Promise<MapRenderer> {
  if (!forceOsm) {
    try {
      return { maps: await loadMaps(), provider: "google" };
    } catch (error) {
      if (!allowFallback) throw error;
      /* Script failure or missing key: keep the map usable. */
    }
  }
  const { mapLibreRenderer } = await import("./maplibre-renderer");
  return { maps: mapLibreRenderer(), provider: "osm" };
}
