import type { RouteLeg, TravelMode } from "@trip/shared";

/**
 * Every mode a route leg may claim. Written as a keyed record rather than an
 * array so adding a TravelMode to the shared contract breaks this build until
 * it is considered here — the previous hardcoded list silently fell behind the
 * contract and would have rejected a legitimate driving leg as invalid.
 */
const ROUTE_MODES: Record<TravelMode, true> = {
  train: true,
  flight: true,
  bus: true,
  walk: true,
  transit: true,
  tram: true,
  ferry: true,
  drive: true,
};

/** Preserve main's end-exclusive planning interval; do not change team date semantics. */
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

/** The existing port returns consecutive legs, not a set of alternatives. */
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
  // A road duration is not evidence that public transport can make this
  // journey. A leg that says so honestly (mode "drive") is fine; one that
  // reports a driving estimate while claiming transit is not.
  if (legs.some((leg) => leg.mode !== "drive" && /OSRM|driving/i.test(leg.note ?? "")))
    return "driving estimate cannot verify public transport timing";
  return undefined;
}

export function fareUnavailable(leg: RouteLeg): boolean {
  // Compatibility with current adapter until A introduces structured fare status.
  return /fare unavailable/i.test(leg.note ?? "");
}
