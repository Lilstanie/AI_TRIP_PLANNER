export interface AgentLabLiveConfig {
  enabled: boolean;

  maxConcurrent: number;

  maxRunsPerHour: number;
}

const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_MAX_RUNS_PER_HOUR = 6;
const CAP_MAX_CONCURRENT = 20;
const CAP_MAX_RUNS_PER_HOUR = 1000;
const HOUR_MS = 60 * 60 * 1000;

type Env = Record<string, string | undefined>;

function limit(value: string | undefined, fallback: number, cap: number): number {
  if (value === undefined || !/^\d+$/.test(value)) return fallback;
  return Math.min(Number(value), cap);
}

export function readLiveConfig(env: Env = process.env): AgentLabLiveConfig {
  return {
    enabled: env.AGENT_LAB_LIVE_ENABLED === "true",
    maxConcurrent: limit(
      env.AGENT_LAB_LIVE_MAX_CONCURRENT,
      DEFAULT_MAX_CONCURRENT,
      CAP_MAX_CONCURRENT,
    ),
    maxRunsPerHour: limit(
      env.AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR,
      DEFAULT_MAX_RUNS_PER_HOUR,
      CAP_MAX_RUNS_PER_HOUR,
    ),
  };
}

export type LiveAdmission =
  | { ok: true; release: () => void }
  | { ok: false; reason: "concurrency_limit" | "rate_limit"; retryAfterSeconds: number };

export interface LiveLimiter {
  tryAcquire: (
    config: Pick<AgentLabLiveConfig, "maxConcurrent" | "maxRunsPerHour">,
  ) => LiveAdmission;
}

export function createLiveLimiter(now: () => number = Date.now): LiveLimiter {
  let active = 0;
  let started: number[] = [];
  return {
    tryAcquire({ maxConcurrent, maxRunsPerHour }) {
      const time = now();
      started = started.filter((at) => time - at < HOUR_MS);
      if (active >= maxConcurrent) {
        return { ok: false, reason: "concurrency_limit", retryAfterSeconds: 10 };
      }
      if (started.length >= maxRunsPerHour) {
        const oldest = started[0];
        const retryAfterSeconds =
          oldest === undefined ? 3600 : Math.max(1, Math.ceil((oldest + HOUR_MS - time) / 1000));
        return { ok: false, reason: "rate_limit", retryAfterSeconds };
      }
      active += 1;
      started.push(time);
      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          active -= 1;
        },
      };
    },
  };
}

const KEY = Symbol.for("ai-trip-planner.agent-lab.live-limiter");
type Holder = { [KEY]?: LiveLimiter };

export function liveLimiter(): LiveLimiter {
  const holder = globalThis as Holder;
  holder[KEY] ??= createLiveLimiter();
  return holder[KEY];
}

export function resetLiveLimiter(): void {
  (globalThis as Holder)[KEY] = createLiveLimiter();
}
