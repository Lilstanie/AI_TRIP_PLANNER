import type { ProposalItem } from "@trip/shared";
import type { RouteMode, RouteResult } from "../integrations/google";

export const WALK_LIMIT_MIN = 20;

export const LEG_MODES = ["walk", "transit", "drive", "cycle"] as const;
export type LegMode = (typeof LEG_MODES)[number];

const ROUTE_MODE: Record<LegMode, RouteMode> = {
  walk: "WALK",
  transit: "TRANSIT",
  drive: "DRIVE",
  cycle: "BICYCLE",
};

export const routeModeOf = (mode: LegMode): RouteMode => ROUTE_MODE[mode];

export const legModeOf = (mode: RouteMode): LegMode =>
  mode === "WALK"
    ? "walk"
    : mode === "TRANSIT"
      ? "transit"
      : mode === "BICYCLE"
        ? "cycle"
        : "drive";

export function storedRouteMode(item: ProposalItem): RouteMode | undefined {
  const mode = item.arriveBy?.mode;
  return mode === "walk" || mode === "transit" || mode === "drive" || mode === "cycle"
    ? routeModeOf(mode)
    : undefined;
}

export type LegRouter = (
  from: string,
  to: string,
  departure: string,
  mode: RouteMode,
) => Promise<RouteResult>;

export async function defaultLegRoute(
  route: LegRouter,
  from: string,
  to: string,
  departure: string,
): Promise<RouteResult> {
  const walk = await route(from, to, departure, "WALK");
  if (walk.status === "ok" && walk.durationMin! <= WALK_LIMIT_MIN) return walk;
  const transit = await route(from, to, departure, "TRANSIT");
  if (transit.status === "ok") return transit;
  return walk;
}

export function simulatedRoute(
  from: string,
  to: string,
  _departure: string,
  mode: RouteMode,
): Promise<RouteResult> {
  let hash = 0;
  for (const char of `${from}>${to}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const walk = 6 + (hash % 25);
  const durationMin =
    mode === "WALK"
      ? walk
      : mode === "TRANSIT"
        ? Math.max(5, Math.round(walk * 0.6) + 4)
        : Math.max(4, Math.round(walk * 0.35) + 3);
  return Promise.resolve({ from, to, mode, status: "ok", durationMin, simulated: true });
}
