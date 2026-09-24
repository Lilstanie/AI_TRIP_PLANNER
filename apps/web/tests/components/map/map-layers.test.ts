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

const colors = { active: "#111111", muted: "#999999" };
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
    // An underlay and a dashed line per day.
    expect(lines).toHaveLength(4);
    expect(lines.filter((line) => line.options.icons)).toHaveLength(2);
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
    expect(lines).toHaveLength(3);
    const dashed = lines.filter((line) => line.options.icons);
    expect(dashed).toHaveLength(1);
    expect(lines.map((line) => line.options.strokeColor)).toContain(colors.muted);
  });

  it("keeps the dashes still, with no frame loop, under reduced motion", () => {
    const request = vi.spyOn(window, "requestAnimationFrame");
    const { runtime, lines } = fakeRuntime();
    drawItineraryRoutes({ runtime, lines: twoDays, routes: [], colors, reducedMotion: true });
    expect(request).not.toHaveBeenCalled();
    expect(lines.filter((line) => line.options.icons)).toHaveLength(2);
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
    expect(lines).toHaveLength(3);
  });
});
