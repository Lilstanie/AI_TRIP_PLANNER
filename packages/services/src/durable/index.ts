type StoredValue = unknown;

type RedisResponse = { result?: unknown; error?: string };

const localValues = new Map<string, StoredValue>();
const localCounters = new Map<string, number>();

function redisConfig(): { url: string; token: string } | undefined {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : undefined;
}

export function durableStoreConfigured(): boolean {
  return redisConfig() !== undefined;
}

async function redisCommand(command: string, ...args: string[]): Promise<unknown> {
  const config = redisConfig();
  if (!config) throw new Error("Durable store is not configured.");
  const path = [command, ...args].map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`${config.url}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
  });
  const body = (await response.json().catch(() => ({}))) as RedisResponse;
  if (!response.ok || body.error) {
    throw new Error(`Durable store ${command} failed: ${body.error ?? response.statusText}`);
  }
  return body.result;
}

export interface JsonStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  increment(key: string): Promise<number>;
  decrement(key: string): Promise<number>;
}

export function createJsonStore(): JsonStore {
  return {
    async get<T>(key: string) {
      if (!durableStoreConfigured()) return localValues.get(key) as T | undefined;
      const result = await redisCommand("get", key);
      if (result === null || result === undefined) return undefined;
      if (typeof result !== "string") return result as T;
      return JSON.parse(result) as T;
    },
    async set<T>(key: string, value: T) {
      if (!durableStoreConfigured()) {
        localValues.set(key, value);
        return;
      }
      await redisCommand("set", key, JSON.stringify(value));
    },
    async increment(key: string) {
      if (!durableStoreConfigured()) {
        const next = (localCounters.get(key) ?? 0) + 1;
        localCounters.set(key, next);
        return next;
      }
      const result = await redisCommand("incr", key);
      const count = Number(result);
      if (!Number.isSafeInteger(count))
        throw new Error("Durable store returned an invalid counter.");
      return count;
    },
    async decrement(key: string) {
      if (!durableStoreConfigured()) {
        const next = Math.max(0, (localCounters.get(key) ?? 0) - 1);
        localCounters.set(key, next);
        return next;
      }
      const result = await redisCommand("decr", key);
      const count = Number(result);
      if (!Number.isSafeInteger(count))
        throw new Error("Durable store returned an invalid counter.");
      return count;
    },
  };
}

export const jsonStore = createJsonStore();
