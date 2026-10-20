import { auth } from "@clerk/nextjs/server";
import { configuredDataMode, parseDataMode, type DataMode } from "@trip/tools";
import { authEnabled } from "./config";

export async function liveDataAllowed(): Promise<boolean> {
  if (!authEnabled) return !process.env.VERCEL_ENV;
  const { userId } = await auth();
  return Boolean(userId);
}

export async function requestDataMode(request: Request): Promise<DataMode> {
  const requested = parseDataMode(request.headers.get("x-trip-data-mode")) ?? configuredDataMode();
  if (requested !== "live") return requested;
  return (await liveDataAllowed()) ? "live" : "mock";
}
