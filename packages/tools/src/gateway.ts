// Owner: A — ToolGateway
// Public entry point that captures one provider policy for every external tool call.
// The Orchestrator calls createToolGateway() once per run and injects the
// result into every agent via AgentContext.tools.

import type { ToolGateway } from "@trip/shared";
import { createToolGatewayWithRuntime, snapshotToolRuntime } from "./gateway-internal";

export function createToolGateway(): ToolGateway {
  const runtime = snapshotToolRuntime();
  return createToolGatewayWithRuntime(runtime);
}
