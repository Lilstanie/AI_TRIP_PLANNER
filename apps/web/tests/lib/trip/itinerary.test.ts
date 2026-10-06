// Ways the Itinerary could fail, written before the module:
// - a place on two days gets a second number, or is missing from the later day's map;
// - an idea (no day) between stops is listed, counted, numbered or drawn as a stop;
// - start times that disagree with plan order make the views list a day in plan order;
// - a day whose stops have no located place disappears from the day list or draws markers;
// - a displayed position is sent to the edit preview as if it were the plan's index.
import { describe, expect, it } from "vitest";
import type { ProposalItem, TripPlan } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import { buildItinerary } from "@/lib/trip/itinerary";

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
      // Moving a one later lands before c, shown at position 1 once a is lifted out (b, c).
      expect(itinerary.planIndex("a", 1, 1)).toBe(0);
      // Moving b earlier, before a: a is plan index 1 among the day's others (c, a).
      expect(itinerary.planIndex("b", 1, 0)).toBe(1);
    });

    it("moves a stop to the end of a day when the position is past its last stop", () => {
      expect(itinerary.planIndex("a", 1, 2)).toBe(2);
      expect(itinerary.planIndex("a", 2, 0)).toBe(0);
    });
  });
});
