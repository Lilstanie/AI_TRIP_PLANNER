/** One process-wide gate shared by all Nominatim consumers. Deploy one instance for public OSM. */
const cache = new Map<string, { expires: number; data: unknown }>();
let busy = false;
let lastRequest = 0;
export class NominatimError extends Error {
  constructor(public reason: "rate_limit" | "unavailable") {
    super(reason);
  }
}
export async function nominatimRequest<T>(url: string, waitForSlot = false): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data as T;
  const deadline = Date.now() + 10000;
  while (busy || Date.now() - lastRequest < 1100) {
    if (!waitForSlot || Date.now() >= deadline) throw new NominatimError("rate_limit");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  busy = true;
  lastRequest = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent":
          process.env.OSM_USER_AGENT && !process.env.OSM_USER_AGENT.includes("contact@example.com")
            ? process.env.OSM_USER_AGENT
            : "AITripPlanner/1.0 (+https://github.com/Lilstanie/AI_TRIP_PLANNER)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new NominatimError(response.status === 429 ? "rate_limit" : "unavailable");
    const data = await response.json();
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(url, { expires: Date.now() + 86400000, data });
    return data as T;
  } catch (error) {
    if (error instanceof NominatimError) throw error;
    throw new NominatimError("unavailable");
  } finally {
    busy = false;
  }
}
