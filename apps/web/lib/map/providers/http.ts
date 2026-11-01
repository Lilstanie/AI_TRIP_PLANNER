import { MapProviderUnavailableError } from "./errors";

export type ProviderFetch = (input: string, init?: RequestInit) => Promise<Response>;
export const contact = () =>
  process.env.OSM_USER_AGENT ||
  "AI-Trip-Planner/0.1 (https://github.com/Lilstanie/AI_TRIP_PLANNER)";

const processState = globalThis as typeof globalThis & {
  __tripNominatim?: { queue: Promise<unknown>; started: number };
};
const nominatim = (processState.__tripNominatim ??= { queue: Promise.resolve(), started: 0 });
export function nominatimRequest<T>(run: () => Promise<T>): Promise<T> {
  const next = nominatim.queue
    .catch(() => undefined)
    .then(async () => {
      const delay = Math.max(0, nominatim.started + 1000 - Date.now());
      if (delay) await new Promise((done) => setTimeout(done, delay));
      nominatim.started = Date.now();
      return run();
    });
  nominatim.queue = next;
  return next;
}

export async function providerResponse(
  url: string,
  fetcher: ProviderFetch = fetch,
): Promise<Response> {
  try {
    return await fetcher(url, {
      headers: { "user-agent": contact(), Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof MapProviderUnavailableError) throw error;
    const name = (error as { name?: string })?.name;
    throw new MapProviderUnavailableError(
      "osm",
      name === "TimeoutError" || name === "AbortError" ? "timeout" : "upstream",
    );
  }
}

export async function providerJson(url: string, fetcher: ProviderFetch = fetch): Promise<unknown> {
  const response = await providerResponse(url, fetcher);
  if (!response.ok) throw new MapProviderUnavailableError("osm", "upstream");
  return response.json().catch(() => {
    throw new MapProviderUnavailableError("osm", "upstream");
  });
}

export function providerCache<T>(ttl = 600_000, now = Date.now) {
  const values = new Map<string, { at: number; value: T }>();
  const pending = new Map<string, Promise<T>>();
  return (key: string, run: () => Promise<T>): Promise<T> => {
    const hit = values.get(key);
    if (hit && now() - hit.at < ttl) return Promise.resolve(hit.value);
    const flight = pending.get(key);
    if (flight) return flight;
    const next = run()
      .then((value) => {
        if (values.size >= 500) values.delete(values.keys().next().value!);
        values.set(key, { at: now(), value });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, next);
    return next;
  };
}
