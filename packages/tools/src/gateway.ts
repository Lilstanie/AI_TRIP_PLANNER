import type { ToolGateway } from "@trip/shared";
import { createToolGatewayWithRuntime, snapshotToolRuntime } from "./gateway-internal";

export function createToolGateway(): ToolGateway {
  const runtime = snapshotToolRuntime();
  return createToolGatewayWithRuntime(runtime);
}
