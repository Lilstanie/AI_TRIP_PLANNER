import { translate, intlLocale, type AppLocale, type MessageKey } from "../i18n/locale";
import { fare } from "../money";
import type {
  ArriveBy,
  FlightSelection,
  ProposalItem,
  StaySelection,
  TripPlan,
} from "@trip/shared";
import type { RouteResult } from "../integrations/google";
import { LEG_MODES, legModeOf, type LegMode } from "./leg-routes";

export type FixedKind = "flight" | "ground" | "stay";

export type FixedRow = {
  type: "fixed";
  key: string;
  kind: FixedKind;
  mode?: string;
  title: string;

  detail: string;
  startTime?: string;
  endTime?: string;

  cost?: number;
  costNote?: string;
};

export type BookingRow = {
  type: "booking";
  key: string;
  kind: "stay" | "flight";

  role: "in" | "out" | "night";
  night?: { index: number; of: number };

  sectionId: "accommodation" | "transport";
  selection: StaySelection | FlightSelection;

  date?: string;
};

export type StopRow<A> = { type: "stop"; activity: A };
export type TimelineRow<A> = FixedRow | BookingRow | StopRow<A>;

const minutes = (time?: string) =>
  time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : undefined;

export function dayCount(plan: TripPlan) {
  const [start, end] = plan.brief.dates.map((date) => Date.parse(`${date}T00:00:00Z`));
  return Math.max(1, Math.round((end! - start!) / 86400000));
}

export function dayLabel(plan: TripPlan, day: number, locale: AppLocale = "en") {
  const time = Date.parse(`${plan.brief.dates[0]}T00:00:00Z`) + (day - 1) * 86400000;
  if (!Number.isFinite(time)) return translate(locale, "Day {v0}", { v0: day });
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(time);
}

function transportRow(item: ProposalItem, index: number, locale: AppLocale): FixedRow {
  const title = item.location ?? item.detail.split(/[:;]/)[0]!.trim();

  if (item.startTime) {
    const mode = /^(\w+) from /i.exec(item.detail)?.[1]?.toLowerCase();
    const duration = /(\d+) minutes/.exec(item.detail)?.[1];
    return {
      type: "fixed",
      key: `transport-${index}`,
      kind: "ground",
      mode,
      title,
      detail: [
        MODE_LABELS[mode ?? ""]
          ? translate(locale, MODE_LABELS[mode!]!)
          : translate(locale, "Transfer"),
        duration && formatDuration(Number(duration), locale),
      ]
        .filter(Boolean)
        .join(" · "),
      startTime: item.startTime,
      endTime: item.endTime,
      cost: item.estCost,
      costNote: /fare unavailable/i.test(item.detail)
        ? translate(locale, "Fare not published")
        : undefined,
    };
  }
  const carrier = item.detail.includes(":") ? item.detail.split(":")[0]!.trim() : undefined;
  const returning = /returning (\d{4}-\d{2}-\d{2})/.exec(item.detail)?.[1];
  return {
    type: "fixed",
    key: `transport-${index}`,
    kind: "flight",
    title,
    detail: [
      carrier,
      returning ? translate(locale, "return flight {date}", { date: returning }) : undefined,
      translate(locale, "whole group"),
    ]
      .filter(Boolean)
      .join(" · "),
    cost: item.estCost,
  };
}

function stayRow(item: ProposalItem, index: number, locale: AppLocale): FixedRow {
  const name = item.detail.split(" — ")[0]!.trim();
  const nights = /(\d+) night/.exec(item.detail)?.[1];

  const match = /rating ([\d.]+)\/(10|5)\b/.exec(item.detail);
  const rating = match
    ? match[2] === "10"
      ? (Number(match[1]) / 2).toFixed(1)
      : match[1]
    : undefined;
  return {
    type: "fixed",
    key: `stay-${index}`,
    kind: "stay",
    title: name,
    detail: [
      translate(locale, "Check in"),
      nights &&
        (locale === "en" && nights === "1"
          ? "1 night"
          : translate(locale, "{count} nights", { count: nights })),
      rating && translate(locale, "rated {rating}/5", { rating }),
    ]
      .filter(Boolean)
      .join(" · "),
    cost: item.estCost,
  };
}

export function stayingAt(plan: TripPlan, day: number): string | undefined {
  const stays = plan.sections.find((section) => section.id === "accommodation")?.proposal?.items;
  for (const item of stays ?? []) {
    const nights = Number(/(\d+) night/.exec(item.detail)?.[1] ?? 0);
    if (item.day !== undefined && day > item.day && day < item.day + nights)
      return item.detail.split(" — ")[0]!.trim();
  }
  return undefined;
}

export function dayRows<A extends { startTime?: string }>(
  plan: TripPlan,
  day: number,
  activities: A[],
  locale: AppLocale = "en",
): TimelineRow<A>[] {
  const proposal = (id: string) => plan.sections.find((section) => section.id === id)?.proposal;
  const transportItems = proposal("transport")?.items ?? [];
  const flights = proposal("transport")?.flights ?? [];
  const stays = proposal("accommodation")?.stays ?? [];
  const flightIds = new Set(flights.map((flight) => flight.id));
  const stayIds = new Set(stays.map((stay) => stay.id));
  const last = dayCount(plan);

  const returnOf = (flightId: string) => {
    const item = transportItems.find((candidate) => candidate.selectionId === flightId);
    const date = item ? /returning (\d{4}-\d{2}-\d{2})/.exec(item.detail)?.[1] : undefined;
    return date && date === plan.brief.dates[1] ? date : undefined;
  };

  const transport = transportItems
    .map((item, index) => [item, index] as const)
    .filter(([item]) => item.day === day && !(item.selectionId && flightIds.has(item.selectionId)))
    .map(([item, index]) => transportRow(item, index, locale));
  const legacyStays = (proposal("accommodation")?.items ?? [])
    .map((item, index) => [item, index] as const)
    .filter(
      ([item]) =>
        item.day === day &&
        item.kind === "hotel" &&
        !(item.selectionId && stayIds.has(item.selectionId)),
    )
    .map(([item, index]) => stayRow(item, index, locale));
  const flightsIn: BookingRow[] = flights
    .filter((flight) => flight.day === day)
    .map((flight) => ({
      type: "booking",
      key: `flight-in-${flight.id}`,
      kind: "flight",
      role: "in",
      sectionId: "transport",
      selection: flight,
      date: flight.depart,
    }));
  const nights: BookingRow[] = stays.flatMap((stay) =>
    Array.from({ length: stay.nights }, (_, offset) => offset)
      .filter((offset) => stay.day + offset === day)
      .map((offset) => ({
        type: "booking" as const,
        key: `stay-${stay.id}-night-${offset + 1}`,
        kind: "stay" as const,
        role: "night" as const,
        night: { index: offset + 1, of: stay.nights },
        sectionId: "accommodation" as const,
        selection: stay,
      })),
  );
  const flightsOut: BookingRow[] =
    day === last
      ? flights.flatMap((flight) => {
          const date = returnOf(flight.id);
          return date
            ? [
                {
                  type: "booking" as const,
                  key: `flight-out-${flight.id}`,
                  kind: "flight" as const,
                  role: "out" as const,
                  sectionId: "transport" as const,
                  selection: flight,
                  date,
                },
              ]
            : [];
        })
      : [];
  const timed: TimelineRow<A>[] = [
    ...transport.filter((row) => row.startTime),
    ...activities.map((activity) => ({ type: "stop" as const, activity })),
  ].sort((left, right) => (startOf(left) ?? 0) - (startOf(right) ?? 0));

  return [
    ...transport.filter((row) => !row.startTime),
    ...flightsIn,
    ...timed,
    ...nights,
    ...legacyStays,
    ...flightsOut,
  ];
}

const startOf = <A extends { startTime?: string }>(row: TimelineRow<A>) =>
  minutes(
    row.type === "fixed" ? row.startTime : row.type === "stop" ? row.activity.startTime : undefined,
  );

export function formatDuration(total: number, locale: AppLocale = "en") {
  const hours = Math.floor(total / 60);
  const rest = Math.round(total % 60);
  if (locale === "zh")
    return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ""}` : `${rest} 分钟`;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

const MODE_LABELS: Record<string, MessageKey> = {
  walk: "Walk",
  WALK: "Walk",
  bus: "Bus",
  train: "Train",
  tram: "Tram",
  ferry: "Ferry",
  drive: "Drive",
  DRIVE: "Drive",
  cycle: "Cycle",
  BICYCLE: "Cycle",
  transit: "Public transport",
  TRANSIT: "Public transport",
  flight: "Fly",
};

const SERVICE_NAMES = { google: "Google", osrm: "OSRM", transitous: "Transitous" } as const;

export type Connection = {
  mode: string;
  label: string;

  service?: string;

  status: "checked" | "planned" | "failed";
  fare?: string;

  choice?: LegMode;
};

export function connectionBetween(
  previous: { placeId?: string } | undefined,
  current: { placeId?: string; arriveBy?: ArriveBy },
  routes: RouteResult[],
  locale: AppLocale = "en",
): Connection | undefined {
  const route =
    previous?.placeId && current.placeId
      ? routes.find((r) => r.from === previous.placeId && r.to === current.placeId)
      : undefined;
  if (route) {
    const choice = legModeOf(route.mode);
    if (route.status !== "ok" || route.durationMin === undefined)
      return {
        mode: route.mode,
        label: translate(locale, "No route found"),
        status: "failed",
        choice,
      };
    return {
      mode: route.mode,
      label: `${MODE_LABELS[route.mode] ? translate(locale, MODE_LABELS[route.mode]!) : route.mode} · ${formatDuration(route.durationMin, locale)}`,

      status: route.simulated ? "planned" : "checked",

      fare: route.fare ? fare(route.fare, locale) : undefined,
      service: route.source && !route.simulated ? SERVICE_NAMES[route.source] : undefined,
      choice,
    };
  }
  if (!previous || !current.arriveBy) return undefined;
  const { mode, line, durationMin } = current.arriveBy;
  return {
    mode,
    label: `${MODE_LABELS[mode] ? translate(locale, MODE_LABELS[mode]!) : mode}${line ? ` ${line}` : ""} · ${formatDuration(durationMin, locale)}`,
    status: "planned",
    choice: (LEG_MODES as readonly string[]).includes(mode) ? (mode as LegMode) : undefined,
  };
}
