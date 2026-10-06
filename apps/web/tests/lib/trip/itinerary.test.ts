// Ways the Itinerary could fail, written before the module:
// - a place on two days gets a second number, or is missing from the later day's map;
// - an idea (no day) between stops is listed, counted, numbered or drawn as a stop;
// - start times that disagree with plan order make the views list a day in plan order;
// - a day whose stops have no located place disappears from the day list or draws markers;
// - a displayed position is sent to the edit preview as if it were the plan's index.
import { describe, expect, it, vi } from "vitest";
import type { ProposalItem, TripPlan } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import { buildItinerary } from "@/lib/trip/itinerary";
import { previewEdit } from "@/lib/trip/trip-edit";
import { plan as fixture } from "@/tests/fixtures/workspace";

type Item = ProposalItem & { id: string };
const stop = (id: string, day: number | undefined, startTime?: string): Item => ({
  id,
  kind: "activity",
  detail: id,
  ...(day === undefined ? {} : { day }),
  ...(startTime ? { startTime, endTime: `${startTime.slice(0, 2)}:59` } : {}),
});
const planOf = (items: ProposalItem[]): TripPlan =>
  ({
    sections: [
      { id: "transport", proposal: { items: [{ kind: "flight", detail: "Fly in", day: 1 }] } },
      { id: "itinerary", proposal: { items } },
    ],
  }) as unknown as TripPlan;
const place = (id: string): GooglePlace => ({
  id,
  displayName: { text: id },
  location: { latitude: 1, longitude: 1 },
});
/** Activities located at the named places; anything not listed has no place. */
const at = (placeOf: Record<string, string>) => (activity: { id?: string }) =>
  placeOf[activity.id!] ? place(placeOf[activity.id!]!) : undefined;

const ids = (list: { activity: { id?: string } }[]) => list.map((entry) => entry.activity.id);

describe("Itinerary", () => {
  it("gives a place visited on two days its first number on both days' maps", () => {
    const itinerary = buildItinerary(
      planOf([stop("temple", 1, "09:00"), stop("market", 1, "11:00"), stop("again", 2, "10:00")]),
      at({ temple: "senso-ji", market: "tsukiji", again: "senso-ji" }),
    );
    expect(itinerary.stopsOn(2).map((entry) => entry.number)).toEqual([1]);
    expect(itinerary.markersFor(2).map((marker) => [marker.activityId, marker.number])).toEqual([
      ["again", 1],
    ]);
    // The whole-trip map shows the place once, at its first visit.
    expect(itinerary.markersFor().map((marker) => [marker.activityId, marker.number])).toEqual([
      ["temple", 1],
      ["market", 2],
    ]);
    expect(itinerary.stopCount).toBe(3);
  });

  it("never lists, counts, numbers or draws an idea between stops", () => {
    const itinerary = buildItinerary(
      planOf([stop("first", 1, "09:00"), stop("idea", undefined), stop("second", 1, "12:00")]),
      at({ first: "a", idea: "b", second: "c" }),
    );
    expect(itinerary.days()).toEqual([1]);
    expect(ids(itinerary.stopsOn(1))).toEqual(["first", "second"]);
    expect(itinerary.stopsOn(1).map((entry) => entry.number)).toEqual([1, 2]);
    expect(itinerary.ideas().map((idea) => idea.id)).toEqual(["idea"]);
    expect(itinerary.stopCount).toBe(2);
    expect(itinerary.markersFor().map((marker) => marker.activityId)).toEqual(["first", "second"]);
    expect(itinerary.stop("idea")).toBeUndefined();
  });

  it("lists a day in visiting order when start times disagree with plan order", () => {
    const itinerary = buildItinerary(
      planOf([
        stop("dinner", 1, "18:00"),
        stop("day-two", 2, "08:00"),
        stop("breakfast", 1, "08:00"),
        stop("lunch-a", 1, "12:00"),
        stop("lunch-b", 1, "12:00"),
      ]),
      at({ dinner: "d", "day-two": "x", breakfast: "b", "lunch-a": "la", "lunch-b": "lb" }),
    );
    expect(itinerary.days()).toEqual([1, 2]);
    expect(ids(itinerary.stopsOn(1))).toEqual(["breakfast", "lunch-a", "lunch-b", "dinner"]);
    expect(itinerary.stopsOn(1).map((entry) => entry.number)).toEqual([1, 2, 3, 4]);
    expect(itinerary.stopsOn(2).map((entry) => entry.number)).toEqual([5]);
    expect(itinerary.markersFor(1).map((marker) => marker.activityId)).toEqual([
      "breakfast",
      "lunch-a",
      "lunch-b",
      "dinner",
    ]);
  });

  it("keeps a day whose stops have no located place, unnumbered and off the map", () => {
    const itinerary = buildItinerary(
      planOf([stop("unknown", 1, "09:00"), stop("found", 2, "09:00")]),
      at({ found: "f" }),
    );
    expect(itinerary.days()).toEqual([1, 2]);
    expect(itinerary.stopsOn(1).map((entry) => entry.number)).toEqual([undefined]);
    expect(itinerary.markersFor(1)).toEqual([]);
    expect(itinerary.stopsOn(2).map((entry) => entry.number)).toEqual([1]);
    expect(itinerary.stopCount).toBe(2);
  });

  it("is empty without a plan", () => {
    const itinerary = buildItinerary(undefined, () => undefined);
    expect(itinerary.days()).toEqual([]);
    expect(itinerary.stopsOn(1)).toEqual([]);
    expect(itinerary.ideas()).toEqual([]);
    expect(itinerary.stopCount).toBe(0);
    expect(itinerary.markersFor()).toEqual([]);
  });

  it("finds a stop by id with its day and number", () => {
    const itinerary = buildItinerary(
      planOf([stop("one", 1, "09:00"), stop("two", 2, "09:00")]),
      at({ one: "p", two: "p" }),
    );
    expect(itinerary.stop("two")).toMatchObject({ day: 2, number: 1 });
    expect(itinerary.stop("missing")).toBeUndefined();
  });

  describe("planIndex", () => {
    // Plan order on day 1: c (15:00), a (09:00), b (12:00). Visiting order: a, b, c.
    const itinerary = buildItinerary(
      planOf([stop("c", 1, "15:00"), stop("a", 1, "09:00"), stop("b", 1, "12:00")]),
      () => undefined,
    );

    it("moves a stop before the stop shown at that position, not the plan's", () => {
      // Moving c to the top of the day lands before a, first in plan order once c is lifted out.
      expect(itinerary.planIndex("c", 1, 0)).toBe(0);
      // Moving a one later lands just after b, the stop it moved past (plan index 2 among c, b).
      expect(itinerary.planIndex("a", 1, 1)).toBe(2);
      // Moving b earlier, before a: a is plan index 1 among the day's others (c, a).
      expect(itinerary.planIndex("b", 1, 0)).toBe(1);
    });

    it("moves a stop to the end of a day when the position is past its last stop", () => {
      expect(itinerary.planIndex("a", 1, 2)).toBe(2);
      expect(itinerary.planIndex("a", 1, 9)).toBe(2);
      expect(itinerary.planIndex("a", 2, 0)).toBe(0);
    });

    it("keeps a position before the first stop at the start of the day", () => {
      expect(itinerary.planIndex("c", 1, -1)).toBe(0);
    });
  });
});

// Ways a timeline move could fail through the unchanged edit preview endpoint, written before the fix:
// - start times that disagree with plan order: "Move later" leaves the stop where it was, or "Move
//   earlier" lands it before the wrong neighbour, because the shown position was read as a plan
//   position;
// - the first stop of a day moved later, or the last moved earlier, does not swap with its neighbour;
// - a day that visits one place twice: the repeat visit moves past the wrong stop or loses the
//   place's first number.
describe("timeline moves through the edit preview", () => {
  type Timed = Item & { placeId: string; startTime: string; endTime: string };
  const timed = (id: string, start: string, placeId = `place-${id}`): Timed => ({
    id,
    kind: "activity",
    detail: id,
    day: 1,
    startTime: start,
    endTime: `${start.slice(0, 2)}:30`,
    placeId,
  });
  const fixturePlan = (items: Timed[]): TripPlan => {
    const p = structuredClone(fixture);
    p.sections.find((section) => section.id === "itinerary")!.proposal!.items = items;
    return p;
  };
  const located = (activity: { placeId?: string }) =>
    activity.placeId ? place(activity.placeId) : undefined;
  const routes = () => ({
    placeDetails: vi.fn(async (id: string) => place(id)),
    timeZone: vi.fn(async () => "Australia/Sydney"),
    googleRoute: vi.fn(
      async (from: string, to: string, _departure: string, mode: "WALK" | "TRANSIT") => ({
        from,
        to,
        mode,
        status: "ok" as const,
        durationMin: 20,
      }),
    ),
  });
  /** Move a stop by `step` shown positions, as the timeline's buttons do, and read the previewed day. */
  async function move(items: Timed[], id: string, step: -1 | 1) {
    const plan = fixturePlan(items);
    const itinerary = buildItinerary(plan, located);
    const shown = itinerary.stopsOn(1).findIndex((entry) => entry.activity.id === id);
    const index = itinerary.planIndex(id, 1, shown + step);
    const result = await previewEdit(
      { plan, baseVersion: plan.editVersion ?? 0, operation: { kind: "move", id, day: 1, index } },
      routes(),
    );
    expect(result.blockers).toEqual([]);
    return buildItinerary(result.plan, located).stopsOn(1);
  }

  it("moves the first stop later past its neighbour", async () => {
    const day = await move([timed("a", "09:00"), timed("b", "11:00"), timed("c", "13:00")], "a", 1);
    expect(ids(day)).toEqual(["b", "a", "c"]);
  });

  it("moves the last stop earlier past its neighbour", async () => {
    const day = await move(
      [timed("a", "09:00"), timed("b", "11:00"), timed("c", "13:00")],
      "c",
      -1,
    );
    expect(ids(day)).toEqual(["a", "c", "b"]);
  });

  it("moves a stop later past the stop shown after it when start times disagree with plan order", async () => {
    // Plan order c, a, b; shown a, b, c.
    const day = await move([timed("c", "15:00"), timed("a", "09:00"), timed("b", "12:00")], "a", 1);
    const order = ids(day);
    expect(order.indexOf("a")).toBeGreaterThan(order.indexOf("b"));
  });

  it("moves a stop earlier past the stop shown before it when start times disagree with plan order", async () => {
    // Plan order b, c, a; shown a, b, c.
    const day = await move(
      [timed("b", "12:00"), timed("c", "15:00"), timed("a", "09:00")],
      "c",
      -1,
    );
    const order = ids(day);
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("b"));
  });

  it("moves a repeat visit earlier and keeps the place's first number", async () => {
    const day = await move(
      [
        timed("temple", "09:00", "senso-ji"),
        timed("market", "11:00"),
        timed("again", "14:00", "senso-ji"),
      ],
      "again",
      -1,
    );
    expect(ids(day)).toEqual(["temple", "again", "market"]);
    expect(day.map((entry) => entry.number)).toEqual([1, 1, 2]);
  });
});
