import { describe, expect, it, vi } from "vitest";
import {
  coveredByItinerary,
  dayRoutes,
  flowOffset,
  FLOW_REPEAT_PX,
  itineraryOrder,
  startFlow,
  type RouteStop,
} from "@/lib/map/itinerary-route";
import { placeCategory } from "@/lib/map/place-category";

const stop = (placeId: string, order: number, day?: number): RouteStop => ({
  placeId,
  order,
  day,
  position: { lat: order, lng: order },
});

describe("itineraryOrder", () => {
  it("orders by day, then start time, keeping plan order for ties and undated items last", () => {
    const items = [
      { id: "late", day: 1, startTime: "15:00" },
      { id: "undated" },
      { id: "day2", day: 2, startTime: "09:00" },
      { id: "early", day: 1, startTime: "09:00" },
      { id: "untimed-a", day: 1 },
      { id: "untimed-b", day: 1 },
    ];
    expect(itineraryOrder(items).map((item) => item.id)).toEqual([
      "early",
      "late",
      "untimed-a",
      "untimed-b",
      "day2",
      "undated",
    ]);
    expect(items[0]!.id).toBe("late"); // input untouched
  });
});

describe("dayRoutes", () => {
  it("draws one line per day through its stops in order, skipping single-stop days", () => {
    const lines = dayRoutes([stop("c", 3, 1), stop("a", 1, 1), stop("b", 2, 1), stop("d", 4, 2)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.day).toBe(1);
    expect(lines[0]!.legs.map((leg) => `${leg.from.placeId}>${leg.to.placeId}`)).toEqual([
      "a>b",
      "b>c",
    ]);
  });

  it("uses a verified route polyline for its exact leg and straight segments otherwise", () => {
    const routes = [
      { from: "a", to: "b", status: "ok", polyline: "encoded-ab" },
      { from: "b", to: "c", status: "unavailable" },
      { from: "c", to: "b", status: "ok", polyline: "reverse" },
    ];
    const lines = dayRoutes([stop("a", 1, 1), stop("b", 2, 1), stop("c", 3, 1)], routes);
    expect(lines[0]!.legs.map((leg) => leg.polyline)).toEqual(["encoded-ab", undefined]);
    expect(coveredByItinerary(routes[0]!, lines)).toBe(true);
    expect(coveredByItinerary(routes[2]!, lines)).toBe(false);
  });
});

describe("flow animation", () => {
  it("wraps the dash offset within one repeat", () => {
    expect(flowOffset(0)).toBe(0);
    for (const ms of [250, 1000, 12_345]) {
      expect(flowOffset(ms)).toBeGreaterThanOrEqual(0);
      expect(flowOffset(ms)).toBeLessThan(FLOW_REPEAT_PX);
    }
  });

  it("draws a static line and schedules no frames when motion is reduced", () => {
    const frame = { request: vi.fn(), cancel: vi.fn() };
    const onFrame = vi.fn();
    const stop = startFlow(onFrame, true, frame);
    expect(onFrame).toHaveBeenCalledExactlyOnceWith(0);
    expect(frame.request).not.toHaveBeenCalled();
    stop();
  });

  it("runs one throttled frame loop and cancels it on stop", () => {
    let next: ((time: number) => void) | undefined;
    const frame = {
      request: vi.fn((fn: (time: number) => void) => {
        next = fn;
        return 7;
      }),
      cancel: vi.fn(),
    };
    const onFrame = vi.fn();
    const stop = startFlow(onFrame, false, frame);
    next!(1000);
    next!(1010); // under the ~30 fps budget: skipped
    next!(1100);
    expect(onFrame).toHaveBeenCalledTimes(2);
    stop();
    expect(frame.cancel).toHaveBeenCalledWith(7);
  });
});

describe("placeCategory", () => {
  it.each([
    ["ramen_restaurant", "food"],
    ["museum", "museum"],
    ["park", "nature"],
    ["hotel", "stay"],
    ["tourist_attraction", "landmark"],
    ["shopping_mall", "shopping"],
    ["car_rental", "pin"],
    [undefined, "pin"],
  ])("maps %s to %s", (type, category) => {
    expect(placeCategory(type)).toBe(category);
  });
});
