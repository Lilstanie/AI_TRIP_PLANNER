// Owner: A — ToolGateway
// One place that decides mock vs real for every external tool call.
// The Orchestrator calls createToolGateway() once per run and injects the
// result into every agent via AgentContext.tools.

import type { ToolGateway } from "@trip/shared";
import * as mapsAdapter from "./maps";
import * as bookingAdapter from "./booking";
import * as weatherAdapter from "./weather";
import { mockEnabled } from "./data-mode";

export function createToolGateway(): ToolGateway {
  const useMock = mockEnabled();
  if (!useMock) {
    const selected = process.env.MAPS_PROVIDER || (process.env.MAPS_API_KEY ? "google" : "osm");
    if (selected === "osm" && !process.env.OSM_USER_AGENT) {
      console.warn("[tools] OSM_USER_AGENT is unset; configure one before production traffic.");
    }
    // Describes booking.ts's tier order (SerpApi -> Google Places estimate ->
    // fixture) for this log line only; booking.ts decides at call time.
    const booking = process.env.SERPAPI_KEY
      ? "SerpApi (real prices; Google Places estimate on failure)"
      : selected === "google"
        ? "Google Places (grounded properties, estimated prices)"
        : "fixture-backed (no SERPAPI_KEY or MAPS_API_KEY set)";
    console.warn(`[tools] Live ${selected} Maps adapter enabled; booking: ${booking}.`);
  }
  return { maps: mapsAdapter, booking: bookingAdapter, weather: weatherAdapter.weather };
}
