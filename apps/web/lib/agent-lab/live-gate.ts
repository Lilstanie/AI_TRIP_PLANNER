// Server-side only. The live gate decides whether a public Agent Lab request may use the deployment's own
// model and provider services, and how much of them it may use. Nothing here is sent to the browser except
// whether live is available.

export interface AgentLabLiveConfig {
  /** True only when the deployment has said so explicitly. */
  enabled: boolean;
  /** Live runs that may be in flight at once. */
  maxConcurrent: number;
  /** Live runs that may start in any rolling hour. */
  maxRunsPerHour: number;
}

const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_MAX_RUNS_PER_HOUR = 6;
const CAP_MAX_CONCURRENT = 20;
const CAP_MAX_RUNS_PER_HOUR = 1000;
const HOUR_MS = 60 * 60 * 1000;

type Env = Record<string, string | undefined>;

/** A non-negative integer, or the default: a limit that cannot be read is never read as no limit. */
function limit(value: string | undefined, fallback: number, cap: number): number {
  if (value === undefined || !/^\d+$/.test(value)) return fallback;
  return Math.min(Number(value), cap);
}

/**
 * Reads the deployment's settings. Live is off unless `AGENT_LAB_LIVE_ENABLED` is exactly `true`. Each limit
 * is a whole number: zero allows nothing, and a missing or unusable value falls back to a small default
 * instead of removing the limit.
 */
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

/**
 * Counts live runs in flight and started in the last hour, in memory. A rejected attempt costs nothing, so
 * trying cannot lock anyone out; a slot is freed exactly once however a run ends.
 *
 * The counts live in one server process. A deployment that runs several instances applies the limits to
 * each, so set them with that in mind.
 */
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

/** One limiter per process, kept across hot reloads so a reload cannot reset the quota. */
export function liveLimiter(): LiveLimiter {
  const holder = globalThis as Holder;
  holder[KEY] ??= createLiveLimiter();
  return holder[KEY];
}

/** Test hook: forgets every count. */
export function resetLiveLimiter(): void {
  (globalThis as Holder)[KEY] = createLiveLimiter();
}
