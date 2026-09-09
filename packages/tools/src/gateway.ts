// Owner: A — ToolGateway
// One place that decides mock vs real for every external tool call.
// The Orchestrator calls createToolGateway() once per run and injects the
// result into every agent via AgentContext.tools.

import type { ToolGateway } from "@trip/shared";
import * as mapsAdapter from "./maps";
import * as bookingAdapter from "./booking";

export function createToolGateway(): ToolGateway {
  const useMock = process.env.USE_MOCK_TOOLS !== "false";
  if (!useMock) {
    const selected = process.env.MAPS_PROVIDER || (process.env.MAPS_API_KEY ? "google" : "osm");
    if (selected === "osm" && !process.env.OSM_USER_AGENT) {
      console.warn("[tools] OSM_USER_AGENT is unset; configure one before production traffic.");
    }
    console.warn(`[tools] Live ${selected} Maps adapter enabled; booking remains fixture-backed.`);
  }
  return { maps: mapsAdapter, booking: bookingAdapter };
}
