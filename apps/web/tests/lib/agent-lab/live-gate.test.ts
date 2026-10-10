import { describe, expect, it } from "vitest";
import { createLiveLimiter, readLiveConfig } from "@/lib/agent-lab/live-gate";

describe("readLiveConfig", () => {
  it("is disabled unless the deployment says exactly true", () => {
    expect(readLiveConfig({}).enabled).toBe(false);
    for (const value of ["", "1", "yes", "TRUE", "True", "on", " true"]) {
      expect(readLiveConfig({ AGENT_LAB_LIVE_ENABLED: value }).enabled).toBe(false);
    }
    expect(readLiveConfig({ AGENT_LAB_LIVE_ENABLED: "true" }).enabled).toBe(true);
  });

  it("uses safe defaults for a missing or unusable limit, never no limit", () => {
    const defaults = readLiveConfig({});
    expect(defaults.maxConcurrent).toBe(1);
    expect(defaults.maxRunsPerHour).toBe(6);
    for (const value of ["", "abc", "-1", "1.5", "NaN", "Infinity"]) {
      const config = readLiveConfig({
        AGENT_LAB_LIVE_MAX_CONCURRENT: value,
        AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR: value,
      });
      expect(config.maxConcurrent).toBe(defaults.maxConcurrent);
      expect(config.maxRunsPerHour).toBe(defaults.maxRunsPerHour);
    }
  });

  it("honours zero as allow nothing, and caps an absurdly high value", () => {
    const zero = readLiveConfig({
      AGENT_LAB_LIVE_MAX_CONCURRENT: "0",
      AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR: "0",
    });
    expect(zero).toMatchObject({ maxConcurrent: 0, maxRunsPerHour: 0 });
    const huge = readLiveConfig({
      AGENT_LAB_LIVE_MAX_CONCURRENT: "100000",
      AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR: "100000000",
    });
    expect(huge.maxConcurrent).toBeLessThanOrEqual(20);
    expect(huge.maxRunsPerHour).toBeLessThanOrEqual(1000);
  });
});

describe("createLiveLimiter", () => {
  const config = (maxConcurrent: number, maxRunsPerHour: number) => ({
    enabled: true,
    maxConcurrent,
    maxRunsPerHour,
  });

  it("admits up to the concurrency limit and rejects beyond it, then admits again after a release", () => {
    let time = 0;
    const limiter = createLiveLimiter(() => time);
    const first = limiter.tryAcquire(config(1, 100));
    expect(first.ok).toBe(true);
    const second = limiter.tryAcquire(config(1, 100));
    expect(second).toMatchObject({ ok: false, reason: "concurrency_limit" });
    if (first.ok) first.release();
    expect(limiter.tryAcquire(config(1, 100)).ok).toBe(true);
  });

  it("frees a slot once however many times it is released", () => {
    const limiter = createLiveLimiter(() => 0);
    const first = limiter.tryAcquire(config(1, 100));
    if (!first.ok) throw new Error("expected admission");
    first.release();
    first.release();
    expect(limiter.tryAcquire(config(1, 100)).ok).toBe(true);
    expect(limiter.tryAcquire(config(1, 100)).ok).toBe(false);
  });

  it("rejects beyond the hourly rate with a retry hint in seconds, and forgets runs past the window", () => {
    let time = 1_000_000;
    const limiter = createLiveLimiter(() => time);
    for (let index = 0; index < 2; index += 1) {
      const slot = limiter.tryAcquire(config(5, 2));
      if (slot.ok) slot.release();
    }
    time += 10 * 60_000;
    const rejected = limiter.tryAcquire(config(5, 2));
    expect(rejected).toMatchObject({ ok: false, reason: "rate_limit" });
    if (!rejected.ok) {
      expect(rejected.retryAfterSeconds).toBe(50 * 60);
    }
    time += 51 * 60_000;
    expect(limiter.tryAcquire(config(5, 2)).ok).toBe(true);
  });

  it("does not count a rejected attempt against the quota or the slots", () => {
    const limiter = createLiveLimiter(() => 0);
    const held = limiter.tryAcquire(config(1, 2));
    for (let index = 0; index < 10; index += 1) limiter.tryAcquire(config(1, 2));
    if (held.ok) held.release();
    expect(limiter.tryAcquire(config(1, 2)).ok).toBe(true);
    const slot = limiter.tryAcquire(config(1, 2));
    expect(slot).toMatchObject({ ok: false, reason: "concurrency_limit" });
  });

  it("allows nothing when a limit is zero, and says to try much later", () => {
    const limiter = createLiveLimiter(() => 0);
    expect(limiter.tryAcquire(config(0, 5))).toMatchObject({
      ok: false,
      reason: "concurrency_limit",
    });
    const none = limiter.tryAcquire(config(5, 0));
    expect(none).toMatchObject({ ok: false, reason: "rate_limit" });
    if (!none.ok) expect(none.retryAfterSeconds).toBe(3600);
  });
});
