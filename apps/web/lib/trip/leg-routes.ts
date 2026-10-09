import type { ProposalItem } from "@trip/shared";
import type { RouteMode, RouteResult } from "../integrations/google";

/**
 * A leg is the journey into a stop from the stop before it on the same day. Its mode and time are the
 * stop's `arriveBy`, which is what the traveller changes and what re-timing reads. Written here so the
 * server (`trip-edit.ts`) and the timeline agree on the mapping. See the leg travel times Agent Note.
 */

/** A walk of this many minutes or less stays a walk; a longer one is checked by public transport. */
export const WALK_LIMIT_MIN = 20;

/** The modes a traveller can choose for one leg, as `arriveBy.mode` stores them. */
export const LEG_MODES = ["walk", "transit", "drive"] as const;
export type LegMode = (typeof LEG_MODES)[number];

const ROUTE_MODE: Record<LegMode, RouteMode> = { walk: "WALK", transit: "TRANSIT", drive: "DRIVE" };

export const routeModeOf = (mode: LegMode): RouteMode => ROUTE_MODE[mode];

/** The stored mode of a route, in `arriveBy` spelling. */
export const legModeOf = (mode: RouteMode): LegMode =>
  mode === "WALK" ? "walk" : mode === "TRANSIT" ? "transit" : "drive";

/**
 * The route mode a stop's leg was last verified with, or undefined when the leg is unrouted or only
 * the planner's estimate (an `arriveBy` whose mode is a service such as `bus` or `train`).
 */
export function storedRouteMode(item: ProposalItem): RouteMode | undefined {
  const mode = item.arriveBy?.mode;
  return mode === "walk" || mode === "transit" || mode === "drive" ? routeModeOf(mode) : undefined;
}

export type LegRouter = (
  from: string,
  to: string,
  departure: string,
  mode: RouteMode,
) => Promise<RouteResult>;

/**
 * The leg a traveller has not chosen: a walk when it is short enough, otherwise public transport when
 * Google finds one. A transit answer of "no route" or an outage keeps the walk, so a long walk is shown
 * as one rather than as no route. A walk that is itself unavailable is returned as unavailable, and an
 * outage on transit after a long walk keeps the walk.
 */
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

/**
 * The simulated provider: a fixed duration for each pair of places and mode, so the same plan always
 * shows the same legs. Walking is 6 to 30 minutes by the pair; transit and driving are shorter. Used
 * only when the request says data mode `mock`; the result is marked `simulated` and never shown as
 * checked.
 */
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
