import type { RouteLeg, TravelMode } from "@trip/shared";

const ROUTE_MODES: Record<TravelMode, true> = {
  train: true,
  flight: true,
  bus: true,
  walk: true,
  transit: true,
  tram: true,
  ferry: true,
  drive: true,
  cycle: true,
};

export function planningDays([start, end]: [string, string]): number {
  const parse = (value: string) => {
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value
    ) {
      throw new Error(`Planning requires a valid YYYY-MM-DD date: ${value}`);
    }
    return time;
  };
  const days = (parse(end) - parse(start)) / 86400000;
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Planning requires ordered dates.");
  return days;
}

export function dateForDay(start: string, day: number): string {
  return new Date(Date.parse(`${start}T00:00:00.000Z`) + (day - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function routeProblem(legs: RouteLeg[]): string | undefined {
  if (!legs.length) return "no route returned";
  if (
    legs.some(
      (leg) =>
        !(leg.mode in ROUTE_MODES) ||
        !Number.isFinite(leg.durationMin) ||
        leg.durationMin <= 0 ||
        !Number.isFinite(leg.price) ||
        leg.price < 0,
    )
  )
    return "invalid route duration, fare or mode";

  if (legs.some((leg) => leg.mode !== "drive" && /OSRM|driving/i.test(leg.note ?? "")))
    return "driving estimate cannot verify public transport timing";
  return undefined;
}

export function fareUnavailable(leg: RouteLeg): boolean {
  return /fare unavailable/i.test(leg.note ?? "");
}

export const DAY_MINUTES = 24 * 60;
export const DEFAULT_DEPARTURE_MINUTES = 9 * 60;
export const EARLY_DEPARTURE_MINUTES = 6 * 60;

export function fitsInPlanningDay(
  durationMin: number,
  startMinutes = DEFAULT_DEPARTURE_MINUTES,
): boolean {
  return startMinutes + Math.ceil(durationMin) < DAY_MINUTES;
}

export function hopDuration(legs: RouteLeg[]): number {
  return legs.reduce((sum, leg) => sum + Math.ceil(leg.durationMin), 0);
}
