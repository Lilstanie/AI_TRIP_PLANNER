import { describe, expect, it } from "vitest";
import { plan, snapshot } from "@/tests/fixtures/workspace";
import { CURRENT_KEY, blankDraft } from "@/lib/workspace/workspace";
import {
  CATALOG_KEY,
  createCatalog,
  parseCatalog,
  reusableBlankConversation,
  restoreWorkspace,
  searchCatalog,
  serializeCatalog,
  updateCatalog,
  upsertCurrent,
  upsertConversationDraft,
} from "@/lib/workspace/catalog";

describe("workspace catalog", () => {
  it("builds stable linked chat and trip records from snapshots", () => {
    const catalog = createCatalog(snapshot, [snapshot]);
    expect(catalog.version).toBe(4);
    expect(catalog.activeTripId).toBe("trip:test-trip");
    expect(catalog.activeConversationId).toBe("conversation:saved-copy");
    expect(catalog.trips).toHaveLength(1);
    expect(catalog.conversations).toHaveLength(1);
    expect(catalog.trips[0].conversationIds).toEqual(["conversation:saved-copy"]);
    expect(parseCatalog(serializeCatalog(catalog))).toEqual(catalog);
  });

  it("reads a bare saved array without mutating it", () => {
    const saved = [JSON.parse(JSON.stringify(snapshot))];
    const before = JSON.stringify(saved);
    const catalog = parseCatalog(JSON.stringify(saved));
    expect(catalog.trips[0].snapshot.version).toBe(3);
    expect(JSON.stringify(saved)).toBe(before);
  });

  it("updates current snapshot and keeps independent conversations linked to one trip", () => {
    const catalog = createCatalog(snapshot);
    const second = {
      ...snapshot,
      id: "another-chat",
      savedAt: "2026-09-17T00:00:00Z",
      input: "Plan museums",
    };
    const next = upsertCurrent(catalog, second);
    expect(next.trips).toHaveLength(1);
    expect(next.conversations).toHaveLength(2);
    expect(next.trips[0].conversationIds).toEqual([
      "conversation:saved-copy",
      "conversation:another-chat",
    ]);
    expect(next.activeConversationId).toBe("conversation:another-chat");
  });

  it("keeps a new conversation independent until it has a generated trip", () => {
    const next = upsertConversationDraft(createCatalog(snapshot), {
      id: "conversation:blank",
      messages: [],
      input: "",
    });
    expect(next.activeTripId).toBeUndefined();
    expect(next.conversations[0]).toMatchObject({
      id: "conversation:blank",
      title: "New chat",
      messages: [],
    });
    expect(next.conversations[0].tripId).toBeUndefined();
  });

  it("searches destination, dates, titles and message text", () => {
    const catalog = createCatalog({
      ...snapshot,
      messages: [{ role: "user", text: "Find galleries" }],
    });
    expect(searchCatalog(catalog, "sydney").trips).toHaveLength(1);
    expect(searchCatalog(catalog, "galleries").conversations).toHaveLength(1);
    expect(searchCatalog(catalog, "2099").trips).toHaveLength(0);
  });

  it("derives the trip label from real state and recomputes a legacy status", () => {
    const catalog = createCatalog(snapshot);
    expect(catalog.trips[0]!.status).toBe("draft");

    // An overrun or an unresolved request is the only thing that makes a trip
    // "needs review" now that nothing can confirm a plan.
    const conflicted = createCatalog({
      ...snapshot,
      plan: {
        ...snapshot.plan,
        overrunPct: 15,
        conflicts: [
          { tripId: snapshot.plan.tripId, targetAgent: "itinerary", reason: "over", constraints: [] },
        ],
      },
    });
    expect(conflicted.trips[0]!.status).toBe("needs_review");

    // A stored catalog from before the change may still say "confirmed". It is
    // recomputed from the plan rather than rejected or relabelled.
    const legacy = {
      ...catalog,
      trips: [{ ...catalog.trips[0]!, status: "confirmed" }],
    };
    expect(parseCatalog(legacy).trips[0]!.status).toBe("draft");
  });

  it("rejects corrupt catalog data without changing the input", () => {
    const corrupt = {
      version: 4,
      conversations: [],
      trips: [],
      layout: {
        preferences: { open: true, width: 1 },
        trip: { open: true, width: 2 },
        view: "chat",
      },
      activeTripId: "missing",
    };
    const before = JSON.stringify(corrupt);
    expect(() => parseCatalog(corrupt)).toThrow();
    expect(JSON.stringify(corrupt)).toBe(before);
  });

  it("updates layout and active IDs through a validated copy", () => {
    const catalog = createCatalog(snapshot);
    const next = updateCatalog(catalog, {
      layout: { view: "map", editorView: "timeline", day: "2026-10-01" },
    });
    expect(next.layout.view).toBe("map");
    expect(next.layout.day).toBe("2026-10-01");
    expect(next.layout.editorView).toBe("timeline");
    expect(catalog.layout.view).toBe("chat");
    expect(plan.tripId).toBe("test-trip");
  });

  it("round-trips a blank conversation's unfinished preferences", () => {
    const draft = { ...blankDraft(), destination: "Lisbon" };
    const next = upsertConversationDraft(createCatalog(snapshot), {
      id: "conversation:blank",
      messages: [],
      input: "warm",
      draft,
    });
    expect(parseCatalog(serializeCatalog(next)).conversations[0]!.draft).toEqual(draft);
    expect(() =>
      parseCatalog({ ...next, conversations: [{ ...next.conversations[0], draft: { bad: 1 } }] }),
    ).toThrow("form is invalid");
  });

  it("continues a blank active conversation without the stored trip", () => {
    const catalog = upsertConversationDraft(createCatalog(snapshot), {
      id: "conversation:blank",
      messages: [],
      input: "warm",
      draft: { ...blankDraft(), destination: "Lisbon" },
    });
    const storage = new Map([
      [CURRENT_KEY, JSON.stringify(snapshot)],
      [CATALOG_KEY, serializeCatalog(catalog)],
    ]);
    const restored = restoreWorkspace({ getItem: (key) => storage.get(key) ?? null });
    expect(restored.plan).toBeUndefined();
    expect(restored.draft.destination).toBe("Lisbon");
    expect(restored.input).toBe("warm");
    expect(restored.conversationId).toBe("conversation:blank");
  });

  it("never reopens the last active trip, but keeps it in history", () => {
    const storage = new Map([[CURRENT_KEY, JSON.stringify({ ...snapshot, input: "left over" })]]);
    const restored = restoreWorkspace({ getItem: (key) => storage.get(key) ?? null });
    expect(restored.plan).toBeUndefined();
    expect(restored.input).toBe("");
    expect(restored.conversationId).toBeUndefined();
    expect(restored.catalog.activeTripId).toBeUndefined();
    expect(restored.catalog.activeConversationId).toBeUndefined();
    expect(restored.catalog.trips.map((trip) => trip.id)).toEqual(["trip:test-trip"]);
  });

  it("reuses an untouched blank chat instead of creating another one on refresh", () => {
    const withBlank = upsertConversationDraft(createCatalog(snapshot), {
      id: "conversation:empty",
      messages: [],
      input: "",
    });
    const catalog = updateCatalog(withBlank, { activeConversationId: "conversation:saved-copy" });
    const storage = new Map([[CATALOG_KEY, serializeCatalog(catalog)]]);
    const restored = restoreWorkspace({ getItem: (key) => storage.get(key) ?? null });
    expect(restored.plan).toBeUndefined();
    expect(restored.conversationId).toBe("conversation:empty");
    expect(restored.catalog.activeConversationId).toBe("conversation:empty");
  });

  it("reuses the newest untouched chat and skips ones holding user content", () => {
    const record = (id: string, updatedAt: string, extra: Partial<{ input: string }> = {}) => ({
      id,
      title: "New chat",
      updatedAt,
      messages: [],
      input: extra.input ?? "",
      draft: blankDraft(),
    });
    const base = createCatalog(snapshot);
    const catalog = parseCatalog({
      ...base,
      conversations: [
        ...base.conversations,
        record("conversation:older", "2026-02-01T00:00:00.000Z"),
        // Blank, but the user typed into it, so reusing it would discard their input.
        record("conversation:typed", "2026-03-01T00:00:00.000Z", { input: "somewhere warm" }),
        record("conversation:newer", "2026-04-01T00:00:00.000Z"),
      ],
    });
    // The trip-linked conversation and the typed one are skipped.
    expect(catalog.conversations).toHaveLength(4);
    expect(reusableBlankConversation(catalog)?.id).toBe("conversation:newer");
    // Only a conversation that produced a trip exists, so a new chat has to be created.
    expect(reusableBlankConversation(base)).toBeUndefined();
  });

  it("reports unreadable history and starts blank without overwriting it", () => {
    const storage = new Map([
      [CURRENT_KEY, JSON.stringify(snapshot)],
      [CATALOG_KEY, "{broken"],
    ]);
    const restored = restoreWorkspace({ getItem: (key) => storage.get(key) ?? null });
    expect(restored.plan).toBeUndefined();
    expect(restored.storageEnabled).toBe(false);
    expect(restored.storageError).toMatch(/history could not be read/);
  });

  it("falls back to default layout values instead of rejecting history", () => {
    const catalog = parseCatalog({
      version: 4,
      conversations: [],
      trips: [],
      layout: { sidebar: { collapsed: "yes" }, trip: { open: 1 }, view: "nowhere" },
    });
    expect(catalog.layout.sidebar.collapsed).toBe(false);
    expect(catalog.layout.trip).toEqual({ open: true, width: 340 });
    expect(catalog.layout.view).toBe("chat");
    const collapsed = updateCatalog(catalog, { layout: { sidebar: { collapsed: true } } });
    expect(parseCatalog(serializeCatalog(collapsed)).layout.sidebar.collapsed).toBe(true);
    expect(catalog.layout.sidebar.width).toBeUndefined();
  });

  it("clamps a stored sidebar width, ignores invalid ones and can reset it", () => {
    const layout = (sidebar: unknown) =>
      parseCatalog({ version: 4, conversations: [], trips: [], layout: { sidebar } }).layout
        .sidebar;
    expect(layout({ width: 312.4 }).width).toBe(312);
    expect(layout({ width: 20 }).width).toBe(200);
    expect(layout({ width: 5000 }).width).toBe(420);
    expect(layout({ width: "wide" }).width).toBeUndefined();
    expect(layout({ width: Number.NaN })).toEqual({ collapsed: false });
    const catalog = parseCatalog({ version: 4, conversations: [], trips: [] });
    const wide = updateCatalog(catalog, { layout: { sidebar: { collapsed: false, width: 300 } } });
    expect(parseCatalog(serializeCatalog(wide)).layout.sidebar.width).toBe(300);
    // Collapsing keeps the width for when the sidebar is expanded again.
    const collapsed = updateCatalog(wide, { layout: { sidebar: { collapsed: true } } });
    expect(collapsed.layout.sidebar).toEqual({ collapsed: true, width: 300 });
    const reset = updateCatalog(wide, {
      layout: { sidebar: { collapsed: false, width: undefined } },
    });
    expect(reset.layout.sidebar).toEqual({ collapsed: false });
  });
});
