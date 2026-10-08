import { describe, it, expect, vi } from "vitest";
import { previewEdit } from "@/lib/trip/trip-edit";
import { NoticeError } from "@/lib/i18n/notice";
import { localInstant, googleRoute, searchPlaces, type RouteMode } from "@/lib/integrations/google";
import { plan as fixture, snapshot } from "@/tests/fixtures/workspace";
import { identifyActivities, parseSnapshot } from "@/lib/workspace/workspace";
function plan() {
  const p = structuredClone(fixture);
  p.sections[0]!.proposal!.items = [
    {
      id: "a",
      kind: "activity",
      detail: "Museum",
      day: 1,
      startTime: "09:00",
      endTime: "10:00",
      placeId: "place-a",
      estCost: 100,
    },
    {
      id: "b",
      kind: "activity",
      detail: "Park",
      day: 1,
      startTime: "10:00",
      endTime: "11:00",
      placeId: "place-b",
      estCost: 100,
    },
  ];
  return p;
}
const dependencies = () => ({
  placeDetails: vi.fn(async (id: string) => ({
    id,
    location: { latitude: -33.8, longitude: 151.2 },
  })),
  timeZone: vi.fn(async () => "Australia/Sydney"),
  googleRoute: vi.fn(async (from: string, to: string, _departure: string, mode: RouteMode) => ({
    from,
    to,
    mode,
    status: "ok" as const,
    durationMin: 20,
  })),
});
describe("P3 edit boundary", () => {
  it("preserves IDs across repeated serialization and reordering", () => {
    // Migration from older snapshots is gone: they carry the pre-AUD `pricePerNightUsd`
    // field and USD amounts, so parseSnapshot rejects them outright.
    const migrated = parseSnapshot(snapshot);
    expect(migrated.version).toBe(4);
    const id = migrated.plan.sections[0]!.proposal!.items[0]!.id;
    expect(id).toBeTruthy();
    expect(
      parseSnapshot(JSON.parse(JSON.stringify(migrated))).plan.sections[0]!.proposal!.items[0]!.id,
    ).toBe(id);
    expect(identifyActivities(migrated.plan)).toEqual(migrated.plan);
  });
  it("preserves identities, uses actual local departure and a 15-minute buffer", async () => {
    const p = plan(),
      deps = dependencies();
    const result = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "move", id: "b", day: 1, index: 0 } },
      deps,
    );
    expect(result.blockers).toEqual([]);
    expect(result.plan.sections[0]!.proposal!.items.map((a) => a.id)).toEqual(["b", "a"]);
    expect(result.plan.sections[0]!.proposal!.items[1]!.startTime).toBe("10:35");
    expect(deps.googleRoute.mock.calls[0]![2]).toBe("2026-10-01T00:00:00.000Z");
    // A clean edit leaves no unresolved request, so the section stays a draft.
    expect(result.plan.conflicts).toEqual([]);
    expect(result.plan.sections[0]!.status).toBe("draft");
    expect(p.sections[0]!.proposal!.items[0]!.id).toBe("a");
  });
  it("rejects stale versions and invalid dates/targets", async () => {
    for (const operation of [
      { kind: "move", id: "bad", day: 1, index: 0 },
      { kind: "move", id: "a", day: 4, index: 0 },
    ])
      await expect(
        previewEdit({ plan: plan(), baseVersion: 0, operation }, dependencies()),
      ).rejects.toThrow();
    await expect(
      previewEdit(
        { plan: plan(), baseVersion: 2, operation: { kind: "move", id: "a", day: 1, index: 0 } },
        dependencies(),
      ),
    ).rejects.toThrow("stale");
  });
  it("blocks unknown automatic routes and day overflow without changing input", async () => {
    const deps = dependencies();
    deps.googleRoute.mockImplementation(async (from, to, _date, mode) => ({
      from,
      to,
      mode,
      status: "unavailable" as never,
      durationMin: undefined as never,
    }));
    const p = plan();
    const result = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "move", id: "b", day: 1, index: 0 } },
      deps,
    );
    expect(result.blockers).toContain("Route unavailable");
    expect(p).toEqual(plan());
  });
  it("allows binding an initially unresolved place as a reviewable draft", async () => {
    const p = plan();
    delete p.sections[0]!.proposal!.items[1]!.placeId;
    const result = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "place", id: "a", placeId: "new" } },
      dependencies(),
    );
    expect(result.blockers).toEqual([]);
    expect(result.plan.conflicts?.length).toBeGreaterThan(0);
    expect(result.plan.sections[0]!.proposal!.items[0]!.priceNeedsReview).toBe(true);
  });
  it("rejects nonexistent and ambiguous DST wall times", () => {
    expect(() => localInstant("2026-10-04", "02:30", "Australia/Sydney")).toThrow(
      "ambiguous or nonexistent",
    );
    expect(() => localInstant("2026-04-05", "02:30", "Australia/Sydney")).toThrow(
      "ambiguous or nonexistent",
    );
    expect(localInstant("2026-10-05", "09:00", "Australia/Sydney")).toBe(
      "2026-10-04T22:00:00.000Z",
    );
  });
  it("reports HTTP failures and unknown fare without making up prices", async () => {
    vi.stubEnv("MAPS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ routes: [{ duration: "90s", polyline: { encodedPolyline: "abc" } }] }),
          ),
      ),
    );
    const route = await googleRoute("a", "b", new Date().toISOString(), "WALK");
    expect(route.durationMin).toBe(2);
    expect(route.fare).toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 429 })),
    );
    expect((await googleRoute("a", "b", new Date().toISOString(), "WALK")).status).toBe(
      "unavailable",
    );
    await expect(searchPlaces("museum", "Sydney")).rejects.toThrow("429");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("does not query transit outside the supported date window", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const result = await googleRoute("a", "b", "2020-01-01T09:00:00Z", "TRANSIT");
    expect(result.status).toBe("unavailable");
    expect(result.error).toContain("date window");
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("blocks midnight overflow while allowing manual unresolved schedules", async () => {
    const p = plan();
    p.sections[0]!.proposal!.items[0]!.startTime = "22:00";
    p.sections[0]!.proposal!.items[0]!.endTime = "23:00";
    const result = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "move", id: "b", day: 1, index: 1 } },
      dependencies(),
    );
    expect(result.blockers.some((b) => b.includes("beyond the day"))).toBe(true);
  });
  it("restores the price-review state when undoing place replacement", async () => {
    const p = plan(),
      deps = dependencies();
    const changed = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "place", id: "a", placeId: "new" } },
      deps,
    );
    const restored = await previewEdit(
      {
        plan: changed.plan,
        baseVersion: 1,
        operation: {
          kind: "undo",
          activities: p.sections[0]!.proposal!.items.map((a) => ({
            id: a.id!,
            day: a.day!,
            startTime: a.startTime!,
            endTime: a.endTime!,
            placeId: a.placeId,
            priceNeedsReview: a.priceNeedsReview,
          })),
        },
      },
      deps,
    );
    expect(restored.plan.sections[0]!.proposal!.items[0]!.priceNeedsReview).toBeUndefined();
    expect(restored.plan.sections[0]!.proposal!.items[0]!.placeId).toBe("place-a");
  });
  it.each([0, -1, NaN, Infinity])(
    "rejects invalid duration %s at the preview boundary",
    async (durationMin) => {
      const deps = dependencies();
      deps.googleRoute.mockImplementation(async (from, to, _date, mode) => ({
        from,
        to,
        mode,
        status: "ok",
        durationMin,
      }));
      const result = await previewEdit(
        { plan: plan(), baseVersion: 0, operation: { kind: "move", id: "b", day: 1, index: 0 } },
        deps,
      );
      expect(result.blockers).toContain("Route unavailable");
    },
  );
  it("keeps an edited section unresolved while its change is unverified", async () => {
    const edited = await previewEdit(
      { plan: plan(), baseVersion: 0, operation: { kind: "place", id: "a", placeId: "new" } },
      dependencies(),
    );
    // The unverified price is the section's own conflict evidence; there is no
    // decision to apply, so the section reports itself as needing attention.
    expect(edited.plan.conflicts?.some((c) => c.targetAgent === "itinerary")).toBe(true);
    expect(edited.plan.sections[0]!.status).toBe("needs_you");
    expect(edited.plan.editVersion).toBe(1);
  });
  it("keeps unresolved route issues on an untouched day", async () => {
    const p = plan();
    p.sections[0]!.proposal!.items.push({
      id: "c",
      kind: "activity",
      detail: "Unresolved day",
      day: 2,
      startTime: "09:00",
      endTime: "10:00",
    });
    p.editIssues = [
      { code: "route_unavailable", message: "Day 2 route unavailable", activityIds: ["c"] },
    ];
    p.sections[0]!.proposal!.conflictsWith = ["Day 2 route unavailable"];
    const result = await previewEdit(
      {
        plan: p,
        baseVersion: 0,
        operation: { kind: "time", id: "a", startTime: "08:00", endTime: "09:00" },
      },
      dependencies(),
    );
    expect(result.plan.conflicts?.some((c) => c.reason.includes("Day 2 route unavailable"))).toBe(
      true,
    );
  });
});

// Blockers and refusals reach the interface as Notices, so a Chinese traveller reads them in
// Chinese. The English `blockers` stay beside them for older clients and for the saved plan.
describe("edit preview notices", () => {
  const verify = (p = plan(), deps = dependencies()) =>
    previewEdit({ plan: p, baseVersion: 0, operation: { kind: "verify", day: 1 } }, deps);

  it("names the day when a stop has no confirmed place", async () => {
    const p = plan();
    delete p.sections[0]!.proposal!.items[1]!.placeId;
    const result = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "move", id: "b", day: 1, index: 0 } },
      dependencies(),
    );
    expect(result.blockerNotices).toEqual([
      {
        key: "Day {day}: confirm the place for every stop first, so travel times between them can be checked.",
        params: { day: 1 },
      },
    ]);
    expect(result.blockers).toEqual([
      "Day 1: confirm the place for every stop first, so travel times between them can be checked.",
    ]);
  });

  it("keeps an unresolved travel-time gap on the saved plan in English", async () => {
    // A verify keeps the stops' exact times; the gap stays on the plan for the conflicts list instead of
    // blocking the preview.
    const result = await verify();
    expect(result.blockerNotices).toEqual([]);
    expect(result.plan.sections[0]!.proposal!.conflictsWith).toContain(
      "Day 1: Park needs at least 35 minutes after the previous activity.",
    );
  });

  it("names the day when a stop would run past midnight", async () => {
    const p = plan();
    p.sections[0]!.proposal!.items[0]!.startTime = "22:00";
    p.sections[0]!.proposal!.items[0]!.endTime = "23:00";
    const result = await previewEdit(
      { plan: p, baseVersion: 0, operation: { kind: "move", id: "b", day: 1, index: 1 } },
      dependencies(),
    );
    expect(result.blockerNotices).toEqual([
      { key: "Day {day}: activity would extend beyond the day.", params: { day: 1 } },
    ]);
  });

  it("keys a route with no provider wording and keeps provider wording raw", async () => {
    const move = { kind: "move", id: "b", day: 1, index: 0 } as const;
    const silent = dependencies();
    silent.googleRoute.mockImplementation(async (from, to, _date, mode) => ({
      from,
      to,
      mode,
      status: "unavailable" as never,
      durationMin: undefined as never,
    }));
    expect(
      (await previewEdit({ plan: plan(), baseVersion: 0, operation: move }, silent)).blockerNotices,
    ).toEqual([{ key: "Route unavailable" }]);
    const worded = dependencies();
    worded.googleRoute.mockImplementation(async (from, to, _date, mode) => ({
      from,
      to,
      mode,
      status: "unavailable" as never,
      durationMin: undefined as never,
      error: "Transit departure is outside Google's supported date window.",
    }));
    expect(
      (await previewEdit({ plan: plan(), baseVersion: 0, operation: move }, worded)).blockerNotices,
    ).toEqual([{ raw: "Transit departure is outside Google's supported date window." }]);
  });

  it("keeps a thrown provider error raw and keys a failure with no wording", async () => {
    const move = { kind: "move", id: "b", day: 1, index: 0 } as const;
    const failing = dependencies();
    failing.placeDetails.mockRejectedValue(new Error("Google request failed (429). Please retry."));
    expect(
      (await previewEdit({ plan: plan(), baseVersion: 0, operation: move }, failing))
        .blockerNotices,
    ).toEqual([{ raw: "Google request failed (429). Please retry." }]);
    const wordless = dependencies();
    wordless.placeDetails.mockRejectedValue("boom");
    expect(
      (await previewEdit({ plan: plan(), baseVersion: 0, operation: move }, wordless))
        .blockerNotices,
    ).toEqual([{ key: "Route verification failed" }]);
  });

  it.each([
    [
      { baseVersion: 3, operation: { kind: "verify", day: 1 } },
      "This edit is stale. Start from the current plan.",
    ],
    [{ operation: { kind: "move", id: "missing", day: 1, index: 0 } }, "Activity not found."],
    [{ operation: { kind: "move", id: "a", day: 1, index: 9 } }, "Invalid activity position."],
    [
      { operation: { kind: "time", id: "a", startTime: "10:00", endTime: "09:00" } },
      "End time must be after start time on the same day.",
    ],
    [{ operation: { kind: "verify", day: 9 } }, "Activity day is outside trip dates."],
    [{ operation: { kind: "undo", activities: [] } }, "Undo activities do not match this plan."],
  ])("refuses %o with a keyed notice", async (input, key) => {
    const error = await previewEdit(
      { plan: plan(), baseVersion: 0, ...input },
      dependencies(),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NoticeError);
    expect((error as NoticeError).notice).toEqual({ key });
    expect((error as NoticeError).message).toBe(key);
  });
});
