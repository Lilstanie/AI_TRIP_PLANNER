import type { ArriveBy, ProposalItem, TripPlan } from "@trip/shared";
import type { RouteResult } from "../integrations/google";

/**
 * What the Timeline tab shows for one day, derived from the plan alone: the fixed transport and
 * stays around the day's activities, in time order. Kept free of React so the rules — which items
 * are fixed, where an untimed flight goes, what a connection says — live in one readable place.
 */

export type FixedKind = "flight" | "ground" | "stay";

/** A booked-in item the timeline shows but cannot edit: a flight, an inter-city hop or a stay. */
export type FixedRow = {
  type: "fixed";
  key: string;
  kind: FixedKind;
  title: string;
  /** One line under the title: carrier, mode and duration, or nights. */
  detail: string;
  startTime?: string;
  endTime?: string;
  /** Undefined when the provider gave no price; the UI says so rather than showing AUD 0. */
  cost?: number;
  costNote?: string;
};

export type StopRow<A> = { type: "stop"; activity: A };
export type TimelineRow<A> = FixedRow | StopRow<A>;

const minutes = (time?: string) =>
  time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : undefined;

export function dayCount(plan: TripPlan) {
  const [start, end] = plan.brief.dates.map((date) => Date.parse(`${date}T00:00:00Z`));
  return Math.max(1, Math.round((end! - start!) / 86400000));
}

/** "Sat 17 Oct" for a trip day, in UTC so the label never shifts with the viewer's zone. */
export function dayLabel(plan: TripPlan, day: number) {
  const time = Date.parse(`${plan.brief.dates[0]}T00:00:00Z`) + (day - 1) * 86400000;
  if (!Number.isFinite(time)) return `Day ${day}`;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(time);
}

function transportRow(item: ProposalItem, index: number): FixedRow {
  const title = item.location ?? item.detail.split(/[:;]/)[0]!.trim();
  // A timed transport item is a ground hop the planner scheduled; an untimed one is a flight.
  if (item.startTime) {
    const mode = /^(\w+) from /i.exec(item.detail)?.[1]?.toLowerCase();
    const duration = /(\d+) minutes/.exec(item.detail)?.[1];
    const label = mode === "drive" ? "Drive" : mode ? mode[0]!.toUpperCase() + mode.slice(1) : "Transfer";
    return {
      type: "fixed",
      key: `transport-${index}`,
      kind: "ground",
      title,
      detail: [label, duration && formatDuration(Number(duration))].filter(Boolean).join(" · "),
      startTime: item.startTime,
      endTime: item.endTime,
      cost: item.estCost,
      costNote: /fare unavailable/i.test(item.detail) ? "Fare not published" : undefined,
    };
  }
  const carrier = item.detail.includes(":") ? item.detail.split(":")[0]!.trim() : undefined;
  const returning = /returning (\d{4}-\d{2}-\d{2})/.exec(item.detail)?.[1];
  return {
    type: "fixed",
    key: `transport-${index}`,
    kind: "flight",
    title,
    detail: [carrier, returning ? `return flight ${returning}` : undefined, "whole group"]
      .filter(Boolean)
      .join(" · "),
    cost: item.estCost,
  };
}

function stayRow(item: ProposalItem, index: number): FixedRow {
  const name = item.detail.split(" — ")[0]!.trim();
  const nights = /(\d+) night/.exec(item.detail)?.[1];
  const rating = /rating ([\d.]+)\/10/.exec(item.detail)?.[1];
  return {
    type: "fixed",
    key: `stay-${index}`,
    kind: "stay",
    title: name,
    detail: [
      "Check in",
      nights && `${nights} ${nights === "1" ? "night" : "nights"}`,
      rating && `rated ${rating}/10`,
    ]
      .filter(Boolean)
      .join(" · "),
    cost: item.estCost,
  };
}

/** The stay a traveller wakes up in on `day`, when it is not also their check-in day. */
export function stayingAt(plan: TripPlan, day: number): string | undefined {
  const stays = plan.sections.find((section) => section.id === "accommodation")?.proposal?.items;
  for (const item of stays ?? []) {
    const nights = Number(/(\d+) night/.exec(item.detail)?.[1] ?? 0);
    if (item.day !== undefined && day > item.day && day < item.day + nights)
      return item.detail.split(" — ")[0]!.trim();
  }
  return undefined;
}

/**
 * One day in visiting order: an untimed flight first (the day starts with arriving), timed hops
 * and activities by start time, and the night's check-in last.
 */
export function dayRows<A extends { startTime?: string }>(
  plan: TripPlan,
  day: number,
  activities: A[],
): TimelineRow<A>[] {
  const fixed = (id: string) =>
    plan.sections.find((section) => section.id === id)?.proposal?.items ?? [];
  const transport = fixed("transport")
    .map((item, index) => [item, index] as const)
    .filter(([item]) => item.day === day)
    .map(([item, index]) => transportRow(item, index));
  const stays = fixed("accommodation")
    .map((item, index) => [item, index] as const)
    .filter(([item]) => item.day === day && item.kind === "hotel")
    .map(([item, index]) => stayRow(item, index));
  const timed: TimelineRow<A>[] = [
    ...transport.filter((row) => row.startTime),
    ...activities.map((activity) => ({ type: "stop" as const, activity })),
  ].sort((left, right) => (startOf(left) ?? 0) - (startOf(right) ?? 0));
  return [...transport.filter((row) => !row.startTime), ...timed, ...stays];
}

const startOf = <A extends { startTime?: string }>(row: TimelineRow<A>) =>
  minutes(row.type === "fixed" ? row.startTime : row.activity.startTime);

export function formatDuration(total: number) {
  const hours = Math.floor(total / 60);
  const rest = Math.round(total % 60);
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

const MODE_LABELS: Record<string, string> = {
  walk: "Walk",
  WALK: "Walk",
  bus: "Bus",
  train: "Train",
  tram: "Tram",
  ferry: "Ferry",
  drive: "Drive",
  transit: "Public transport",
  TRANSIT: "Public transport",
  flight: "Fly",
};

export type Connection = {
  mode: string;
  label: string;
  /** `checked`: a route check found it; `planned`: the planner's estimate; `failed`: no route. */
  status: "checked" | "planned" | "failed";
  fare?: string;
};

/**
 * How the traveller gets from one stop to the next: the route a check verified between their two
 * places when there is one, otherwise the planner's own estimate.
 */
export function connectionBetween(
  previous: { placeId?: string } | undefined,
  current: { placeId?: string; arriveBy?: ArriveBy },
  routes: RouteResult[],
): Connection | undefined {
  const route =
    previous?.placeId && current.placeId
      ? routes.find((r) => r.from === previous.placeId && r.to === current.placeId)
      : undefined;
  if (route) {
    if (route.status !== "ok" || route.durationMin === undefined)
      return { mode: route.mode, label: "No route found", status: "failed" };
    return {
      mode: route.mode,
      label: `${MODE_LABELS[route.mode] ?? route.mode} · ${formatDuration(route.durationMin)}`,
      status: "checked",
      // The provider's own currency: not converted and not counted in the AUD budget.
      fare: route.fare ? `${route.fare.currency} ${route.fare.amount.toFixed(2)}` : undefined,
    };
  }
  if (!previous || !current.arriveBy) return undefined;
  const { mode, line, durationMin } = current.arriveBy;
  return {
    mode,
    label: `${MODE_LABELS[mode] ?? mode}${line ? ` ${line}` : ""} · ${formatDuration(durationMin)}`,
    status: "planned",
  };
}
