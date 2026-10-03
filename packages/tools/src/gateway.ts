// Owner: A — ToolGateway
// One place that decides mock vs real for every external tool call.
// The Orchestrator calls createToolGateway() once per run and injects the
// result into every agent via AgentContext.tools.

import type { ToolGateway } from "@trip/shared";
import { createToolGatewayWithRuntime, snapshotToolRuntime } from "./gateway-internal";

export function createToolGateway(): ToolGateway {
  const runtime = snapshotToolRuntime();
  if (runtime.dataMode === "live") {
    // Describes booking.ts's tier order (SerpApi -> Google Places estimate ->
    // fixture) for this log line only; booking.ts decides at call time.
    const booking = runtime.serpApiKey
      ? "SerpApi (real prices; Google Places estimate on failure)"
      : runtime.mapsProvider === "google"
        ? "Google Places (grounded properties, estimated prices)"
        : "fixture-backed (no SERPAPI_KEY or MAPS_API_KEY set)";
    console.warn(`[tools] Live booking: ${booking}.`);
  }
  return createToolGatewayWithRuntime(runtime);
}
