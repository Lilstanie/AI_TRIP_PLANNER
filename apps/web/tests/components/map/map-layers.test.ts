import { describe, expect, it, vi } from "vitest";
import { drawItineraryRoutes, markerContent, markerTitle } from "@/components/map/map-layers";
import type { MapRuntime } from "@/components/map/google-maps-sdk";
import { dayRoutes, type RouteStop } from "@/lib/map/itinerary-route";

const stop = (placeId: string, order: number, day: number): RouteStop => ({
  placeId,
  order,
  day,
  position: { lat: order, lng: order },
});

function fakeRuntime() {
  const lines: { options: Record<string, unknown>; setMap: ReturnType<typeof vi.fn> }[] = [];
  const runtime = {
    map: {},
    maps: {
      Polyline: vi.fn(function (this: unknown, options: Record<string, unknown>) {
        const line = { options, setMap: vi.fn(), setOptions: vi.fn() };
        lines.push(line);
        return line;
      }),
      geometry: { encoding: { decodePath: vi.fn(() => [{ lat: 9, lng: 9 }]) } },
    },
  } as unknown as MapRuntime;
  return { runtime, lines };
}

const colors = {
  day: (day?: number) => `#day${day ?? 0}`,
  muted: "#999999",
  casing: "#ffffff",
};
/** The flowing dashes: the only lines whose icon repeats along them. */
const dashed = (lines: { options: Record<string, unknown> }[]) =>
  lines.filter((line) =>
    (line.options.icons as { repeat?: string }[] | undefined)?.some((icon) => icon.repeat),
  );
const twoDays = dayRoutes([stop("a", 1, 1), stop("b", 2, 1), stop("c", 3, 2), stop("d", 4, 2)]);

describe("markerContent", () => {
  it("labels a marker with its stop number, category icon and place name", () => {
    const place = { id: "p", displayName: { text: "Art Gallery of NSW" }, primaryType: "museum" };
    const content = markerContent(place, 3, 2);
    expect(content.querySelector(".trip-map-marker__badge")?.textContent).toBe("3");
    expect(content.querySelector(".trip-map-marker__name")?.textContent).toBe("Art Gallery of NSW");
    expect(content.querySelector(".trip-map-marker__label svg")).not.toBeNull();
    expect(content.dataset.day).toBe("2");
    expect(markerTitle(place, 3, 2)).toBe("3. Art Gallery of NSW · Day 2");
  });
});

describe("drawItineraryRoutes", () => {
  it("animates every day when nothing is focused and removes all lines on cleanup", () => {
    const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { runtime, lines } = fakeRuntime();
    const cleanup = drawItineraryRoutes({
      runtime,
      lines: twoDays,
      routes: [],
      colors,
      reducedMotion: false,
    });
    // Per leg: a casing, the day-coloured line with its direction chevron, and flowing dashes.
    expect(lines).toHaveLength(6);
    expect(dashed(lines)).toHaveLength(2);
    expect(lines.map((line) => line.options.strokeColor)).toEqual(
      expect.arrayContaining(["#day1", "#day2", colors.casing]),
    );
    expect(request).toHaveBeenCalledOnce();
    cleanup();
    expect(cancel).toHaveBeenCalledOnce();
    lines.forEach((line) => expect(line.setMap).toHaveBeenCalledWith(null));
  });

  it("dashes only the focused day and mutes the others", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { runtime, lines } = fakeRuntime();
    drawItineraryRoutes({
      runtime,
      lines: twoDays,
      routes: [],
      focusDay: 2,
      colors,
      reducedMotion: false,
    });
    expect(lines).toHaveLength(4);
    expect(dashed(lines)).toHaveLength(1);
    expect(lines.map((line) => line.options.strokeColor)).toContain(colors.muted);
    expect(lines.map((line) => line.options.strokeColor)).not.toContain("#day1");
  });

  it("keeps the dashes still, with no frame loop, under reduced motion", () => {
    const request = vi.spyOn(window, "requestAnimationFrame");
    const { runtime, lines } = fakeRuntime();
    drawItineraryRoutes({ runtime, lines: twoDays, routes: [], colors, reducedMotion: true });
    expect(request).not.toHaveBeenCalled();
    expect(dashed(lines)).toHaveLength(2);
  });

  it("follows a verified polyline for its leg and still draws unrelated verified routes", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { runtime, lines } = fakeRuntime();
    const routes = [
      { from: "a", to: "b", mode: "WALK" as const, status: "ok" as const, polyline: "ab" },
      { from: "x", to: "y", mode: "WALK" as const, status: "ok" as const, polyline: "xy" },
    ];
    drawItineraryRoutes({
      runtime,
      lines: dayRoutes([stop("a", 1, 1), stop("b", 2, 1)], routes),
      routes,
      colors,
      reducedMotion: true,
    });
    expect(runtime.maps.geometry.encoding.decodePath).toHaveBeenCalledWith("ab");
    expect(runtime.maps.geometry.encoding.decodePath).toHaveBeenCalledWith("xy");
    expect(lines).toHaveLength(4);
  });

  it("bends a leg without a verified route into an arc between its stops", () => {
    const { runtime, lines } = fakeRuntime();
    drawItineraryRoutes({
      runtime,
      lines: dayRoutes([stop("a", 1, 1), stop("b", 2, 1)]),
      routes: [],
      colors,
      reducedMotion: true,
    });
    const path = lines[0]!.options.path as { lat: number; lng: number }[];
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toEqual({ lat: 1, lng: 1 });
    expect(path.at(-1)).toEqual({ lat: 2, lng: 2 });
    // The midpoint sits off the straight line between the stops.
    const middle = path[Math.floor(path.length / 2)]!;
    expect(Math.abs(middle.lat - middle.lng)).toBeGreaterThan(0.05);
  });
});
