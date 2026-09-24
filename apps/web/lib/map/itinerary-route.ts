/**
 * Itinerary order and route lines for the map, free of the Google Maps SDK so they can be tested.
 *
 * Stops are ordered by day, then start time, then their position in the plan. Each day becomes one
 * line through its stops. A leg uses a verified Google Routes polyline when one exists for that
 * exact pair of places; otherwise it is a straight segment. No route is requested just to draw.
 */

type Orderable = { day?: number; startTime?: string };

/** Sort itinerary activities into visiting order without mutating the input. */
export function itineraryOrder<T extends Orderable>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (a.item.day ?? Number.MAX_SAFE_INTEGER) - (b.item.day ?? Number.MAX_SAFE_INTEGER) ||
        (a.item.startTime ?? "99:99").localeCompare(b.item.startTime ?? "99:99") ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

export type Coordinate = { lat: number; lng: number };
/** One located stop on the map, in visiting order. `order` is 1-based across the whole trip. */
export type RouteStop = { placeId: string; day?: number; order: number; position: Coordinate };
export type RouteLeg = { from: RouteStop; to: RouteStop; polyline?: string };
export type DayRoute = { day?: number; legs: RouteLeg[] };
type VerifiedRoute = { from: string; to: string; status: string; polyline?: string };

/** Group stops into per-day lines; a day with a single stop has no line. */
export function dayRoutes(
  stops: readonly RouteStop[],
  routes: readonly VerifiedRoute[] = [],
): DayRoute[] {
  const verified = new Map(
    routes
      .filter((route) => route.status === "ok" && route.polyline)
      .map((route) => [`${route.from}>${route.to}`, route.polyline!]),
  );
  const days = new Map<number | undefined, RouteStop[]>();
  for (const stop of [...stops].sort((a, b) => a.order - b.order)) {
    const list = days.get(stop.day) ?? [];
    list.push(stop);
    days.set(stop.day, list);
  }
  return [...days].flatMap(([day, list]) => {
    const legs = list.slice(1).map((to, index) => {
      const from = list[index]!;
      const polyline = verified.get(`${from.placeId}>${to.placeId}`);
      return polyline ? { from, to, polyline } : { from, to };
    });
    return legs.length ? [{ day, legs }] : [];
  });
}

/** True when a verified route is already drawn as part of an itinerary leg. */
export function coveredByItinerary(route: VerifiedRoute, lines: readonly DayRoute[]) {
  return lines.some((line) =>
    line.legs.some((leg) => leg.from.placeId === route.from && leg.to.placeId === route.to),
  );
}

/** Pixels the dashes travel per second along the line: slow enough to read as direction, not noise. */
export const FLOW_SPEED_PX = 24;
/** Distance between dash starts; the offset wraps at this length so the loop is seamless. */
export const FLOW_REPEAT_PX = 18;

/** Dash offset for elapsed milliseconds, wrapped into one repeat. */
export function flowOffset(elapsedMs: number) {
  return ((elapsedMs / 1000) * FLOW_SPEED_PX) % FLOW_REPEAT_PX;
}

/**
 * Drive an animation from one requestAnimationFrame loop, throttled to about 30 frames a second.
 * Returns a stop function; nothing runs when motion is reduced.
 */
export function startFlow(
  onFrame: (offsetPx: number) => void,
  reducedMotion: boolean,
  frame: {
    request(fn: (time: number) => void): number;
    cancel(id: number): void;
  } = {
    request: (fn) => requestAnimationFrame(fn),
    cancel: (id) => cancelAnimationFrame(id),
  },
) {
  if (reducedMotion) {
    onFrame(0);
    return () => {};
  }
  let handle = 0;
  let start: number | undefined;
  let last = -Infinity;
  const tick = (time: number) => {
    start ??= time;
    if (time - last >= 33) {
      last = time;
      onFrame(flowOffset(time - start));
    }
    handle = frame.request(tick);
  };
  handle = frame.request(tick);
  return () => frame.cancel(handle);
}
