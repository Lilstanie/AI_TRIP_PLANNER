import { auth } from "@clerk/nextjs/server";
import { configuredDataMode, parseDataMode, type DataMode } from "@trip/tools";
import { authEnabled } from "./config";

/**
 * Whether this caller may spend the shared provider allowance.
 *
 * Signed-in users may. When Clerk is not configured there is nobody to identify, so live data is
 * allowed only outside production: a deployment that reaches the public internet without
 * authentication must not bill the team for anonymous traffic.
 */
export async function liveDataAllowed(): Promise<boolean> {
  if (!authEnabled) return process.env.NODE_ENV !== "production";
  const { userId } = await auth();
  return Boolean(userId);
}

/**
 * The data mode this request actually runs in.
 *
 * `x-trip-data-mode` comes from the browser, so it is a request, not a decision. A caller who may
 * not use live data is downgraded to mock rather than refused, which keeps the workspace usable
 * for signed-out visitors.
 */
export async function requestDataMode(request: Request): Promise<DataMode> {
  const requested = parseDataMode(request.headers.get("x-trip-data-mode")) ?? configuredDataMode();
  if (requested !== "live") return requested;
  return (await liveDataAllowed()) ? "live" : "mock";
}
