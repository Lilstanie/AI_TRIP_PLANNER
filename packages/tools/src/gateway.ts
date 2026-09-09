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
    if (!process.env.MAPS_API_KEY) {
      throw new Error("USE_MOCK_TOOLS=false requires MAPS_API_KEY for the Google Maps adapter.");
    }
    // Booking remains fixture-backed until a provider is configured. Maps is live.
    console.warn("[tools] Live Google Maps adapter enabled; booking remains fixture-backed.");
  }
  return { maps: mapsAdapter, booking: bookingAdapter };
}
