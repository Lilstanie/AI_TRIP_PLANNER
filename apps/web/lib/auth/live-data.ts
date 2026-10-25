import { auth } from "@clerk/nextjs/server";
import { configuredDataMode, parseDataMode, type DataMode } from "@trip/tools";
import { authEnabled } from "./config";

export type LiveDataBlock = "sign-in-required" | "auth-not-configured";

export async function liveDataBlock(): Promise<LiveDataBlock | undefined> {
  if (!authEnabled) return process.env.VERCEL_ENV ? "auth-not-configured" : undefined;
  const { userId } = await auth();
  return userId ? undefined : "sign-in-required";
}

export async function liveDataAllowed(): Promise<boolean> {
  return (await liveDataBlock()) === undefined;
}

export async function requestDataMode(request: Request): Promise<DataMode> {
  const requested = parseDataMode(request.headers.get("x-trip-data-mode")) ?? configuredDataMode();
  if (requested !== "live") return requested;
  return (await liveDataAllowed()) ? "live" : "mock";
}
