import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const files: string[] = [];

afterEach(() => {
  delete process.env.TRIP_MEMORY_FILE;
  for (const file of files.splice(0)) rmSync(file, { force: true });
  vi.resetModules();
});

async function loadMemory(file: string) {
  process.env.TRIP_MEMORY_FILE = file;
  vi.resetModules();
  return (await import("./index")).memory;
}

describe("file-backed trip memory", () => {
  it("persists trip metadata, latest plan, and chat turns across a reload", async () => {
    const file = join(tmpdir(), `ai-trip-planner-${randomUUID()}.json`);
    files.push(file);
    const first = await loadMemory(file);
    const trip = {
      tripId: "trip-1",
      userId: "demo-user",
      title: "Sydney",
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:02:00.000Z",
      plan: {
        tripId: "trip-1",
        planVersion: "plan-v1",
        brief: {
          tripId: "trip-1",
          userId: "demo-user",
          destination: "Sydney",
          dates: ["2026-10-01", "2026-10-05"] as [string, string],
          groupSize: 2,
          budgetTotal: 3000,
        },
        round: 1,
        budgetTotal: 3000,
        estTotal: 1800,
        overrunPct: -40,
        sections: [],
        hitl: [],
      },
    };

    await first.appendShortTerm("trip-1", {
      role: "user",
      content: "Plan Sydney",
      at: "2026-09-09T00:00:00.000Z",
    });
    await first.appendShortTerm("trip-1", {
      role: "assistant",
      content: "Plan ready",
      at: "2026-09-09T00:01:00.000Z",
    });
    await first.saveTrip?.(trip);

    const reloaded = await loadMemory(file);
    await expect(reloaded.getTrip?.("trip-1")).resolves.toEqual(trip);
    await expect(reloaded.getShortTerm("trip-1")).resolves.toMatchObject([
      { role: "user", content: "Plan Sydney" },
      { role: "assistant", content: "Plan ready" },
    ]);
    await expect(reloaded.listTrips?.("demo-user")).resolves.toEqual([
      expect.objectContaining({
        tripId: "trip-1",
        destination: "Sydney",
        planVersion: "plan-v1",
      }),
    ]);
    await expect(reloaded.listTrips?.("someone-else")).resolves.toEqual([]);
  });
});
