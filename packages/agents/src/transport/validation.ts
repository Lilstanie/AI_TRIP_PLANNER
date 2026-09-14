import type { RouteLeg } from "@trip/shared";

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
        !["train", "flight", "bus", "walk", "transit"].includes(leg.mode) ||
        !Number.isFinite(leg.durationMin) ||
        leg.durationMin <= 0 ||
        !Number.isFinite(leg.priceUsd) ||
        leg.priceUsd < 0,
    )
  )
    return "invalid route duration, fare or mode";
  // The current shared port has no driving mode. A road duration is not evidence
  // that public transit can make this journey. Keep that ambiguity explicit.
  if (legs.some((leg) => /OSRM|driving/i.test(leg.note ?? "")))
    return "driving estimate cannot verify public transport timing";
  return undefined;
}

export function fareUnavailable(leg: RouteLeg): boolean {
  // Compatibility with current adapter until A introduces structured fare status.
  return /fare unavailable/i.test(leg.note ?? "");
}
