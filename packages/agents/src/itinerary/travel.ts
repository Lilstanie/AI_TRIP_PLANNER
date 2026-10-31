import type {
  AgentContext,
  ArriveBy,
  GeoPoint,
  Place,
  RouteLeg,
  RouteOption,
  RouteQuery,
  TravelMode,
  TripBrief,
} from "@trip/shared";
import { dateForDay, isDrivingEstimate, routeProblem } from "../transport/validation";
import { minutes } from "./landing";
import type { ItineraryDraft } from "./index";

/** Conflicts between stops, and how many hops were timed by a driving estimate. */
export type TravelCheck = { conflicts: string[]; drivingEstimates: number };

export type Connections = Map<string, ArriveBy>;

export const connectionKey = (activity: { day: number; startTime: string; location: string }) =>
  `${activity.day}|${activity.startTime}|${activity.location}`;

function describeHop(
  legs: RouteLeg[],
  options: RouteOption[],
): { mode: TravelMode; line?: string } {
  const best = options.find((option) => option.mode !== "drive") ?? options[0];

  const line = best?.note?.match(/via [a-z]+ ([\w-]+)/i)?.[1];
  if (best) return { mode: best.mode, ...(line ? { line } : {}) };
  const leg = legs[0];
  return { mode: leg?.mode ?? "transit" };
}

export function placeCoordinates(places: Place[]): ReadonlyMap<string, GeoPoint> {
  return new Map(
    places.flatMap((place) =>
      place.location ? [[place.name.trim().toLocaleLowerCase(), place.location] as const] : [],
    ),
  );
}

export async function travelConflicts(
  draft: ItineraryDraft,
  ctx: AgentContext,
  brief: TripBrief,
  connections: Connections,
  coordinates: ReadonlyMap<string, GeoPoint>,
): Promise<TravelCheck> {
  const conflicts: string[] = [];
  let drivingEstimates = 0;
  const days = new Set(draft.activities.map((activity) => activity.day));
  for (const day of days) {
    const activities = draft.activities
      .filter((activity) => activity.day === day)
      .sort((left, right) => minutes(left.startTime) - minutes(right.startTime));
    for (let index = 1; index < activities.length; index += 1) {
      const previous = activities[index - 1]!;
      const current = activities[index]!;
      if (previous.location === current.location) continue;
      ctx.signal?.throwIfAborted();

      const at = (name: string) => coordinates.get(name.trim().toLocaleLowerCase());
      const fromLocation = at(previous.location);
      const toLocation = at(current.location);
      const query: RouteQuery = {
        from: previous.location,
        to: current.location,
        date: dateForDay(brief.dates[0], day),
        localTime: previous.endTime,
        ...(fromLocation ? { fromLocation } : {}),
        ...(toLocation ? { toLocation } : {}),
      };
      let legs;
      try {
        legs = await ctx.tools.maps.route(query);
      } catch {
        ctx.signal?.throwIfAborted();
        conflicts.push(
          `geography conflict on day ${day}: route provider failed; connection unverified`,
        );
        continue;
      }
      ctx.signal?.throwIfAborted();
      const problem = routeProblem(legs, { acceptDrivingEstimates: true });
      if (problem) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location}: ${problem}`,
        );
        continue;
      }
      if (legs.some(isDrivingEstimate)) drivingEstimates += 1;
      const durationMin = Math.ceil(legs.reduce((sum, leg) => sum + leg.durationMin, 0));

      const options = ctx.tools.maps.routeOptions
        ? await ctx.tools.maps.routeOptions(query).catch(() => [] as RouteOption[])
        : [];
      if (durationMin > 0) {
        const { mode, line } = describeHop(legs, options);
        connections.set(connectionKey(current), {
          mode,
          durationMin,
          ...(line ? { line } : {}),
          from: previous.location,
        });
      }
      const required = durationMin + 15;
      const available = minutes(current.startTime) - minutes(previous.endTime);
      if (required > available) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location} needs ${required} minutes including a 15-minute buffer but only ${available} are available`,
        );
      }
    }
  }
  return { conflicts, drivingEstimates };
}
