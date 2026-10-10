"use client";
import { loadMaps, type MapsSDK } from "./google-maps-sdk";

export type MapRenderer = { maps: MapsSDK; provider: "google" | "osm" };
export async function loadRenderer(forceOsm = false, allowFallback = true): Promise<MapRenderer> {
  if (!forceOsm) {
    try {
      return { maps: await loadMaps(), provider: "google" };
    } catch (error) {
      if (!allowFallback) throw error;
    }
  }
  const { mapLibreRenderer } = await import("./maplibre-renderer");
  return { maps: mapLibreRenderer(), provider: "osm" };
}
