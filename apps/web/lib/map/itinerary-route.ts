export type Coordinate = { lat: number; lng: number };

export type RouteStop = { placeId: string; day?: number; position: Coordinate };
export type RouteLeg = { from: RouteStop; to: RouteStop; polyline?: string };
export type DayRoute = { day?: number; legs: RouteLeg[] };
type VerifiedRoute = { from: string; to: string; status: string; polyline?: string };

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
  for (const stop of stops) {
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

export function coveredByItinerary(route: VerifiedRoute, lines: readonly DayRoute[]) {
  return lines.some((line) =>
    line.legs.some((leg) => leg.from.placeId === route.from && leg.to.placeId === route.to),
  );
}

export const FLOW_SPEED_PX = 24;

export const FLOW_REPEAT_PX = 18;

export function flowOffset(elapsedMs: number) {
  return ((elapsedMs / 1000) * FLOW_SPEED_PX) % FLOW_REPEAT_PX;
}

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

const toMercator = ({ lat, lng }: Coordinate) => {
  const phi = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return { x: (lng * Math.PI) / 180, y: Math.log(Math.tan(Math.PI / 4 + phi / 2)) };
};
const fromMercator = ({ x, y }: { x: number; y: number }): Coordinate => ({
  lat: ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI,
  lng: (x * 180) / Math.PI,
});

export function curvedPath(from: Coordinate, to: Coordinate, bend = 0.18, samples = 32) {
  const a = toMercator(from);
  const b = toMercator(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return [from, to];
  const control = { x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend };
  return Array.from({ length: samples + 1 }, (_, index) => {
    if (index === 0) return from;
    if (index === samples) return to;
    const t = index / samples;
    const u = 1 - t;
    return fromMercator({
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    });
  });
}
