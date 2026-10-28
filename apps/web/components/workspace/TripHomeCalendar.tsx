"use client";
import { useMemo } from "react";
import type { TripPlan } from "@trip/shared";
import { intlLocale, translate, type AppLocale } from "@/lib/i18n/locale";
import { useLocale } from "../account/LocaleProvider";
import { FlowAttractionIcon, FlowFlightIcon, FlowStayIcon } from "../ui/flow-icons";

const DAY_MS = 86400000;
type Activity = { category: "stop" | "flight" | "stay"; label: string };

function timestamp(date: string | undefined) {
  if (!date) return undefined;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) ? time : undefined;
}

function tripDay(start: number, time: number) {
  return Math.floor((time - start) / DAY_MS) + 1;
}

function name(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function activitiesByDay(plan: TripPlan) {
  const start = timestamp(plan.brief.dates[0])!;
  const end = timestamp(plan.brief.dates[1])!;
  const activities = new Map<number, Activity[]>();
  const add = (day: number, activity: Activity) => {
    if (!Number.isInteger(day) || day < 1 || start + (day - 1) * DAY_MS > end) return;
    const entries = activities.get(day) ?? [];
    if (
      !entries.some(
        (entry) => entry.category === activity.category && entry.label === activity.label,
      )
    )
      entries.push(activity);
    activities.set(day, entries);
  };

  for (const item of plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ??
    []) {
    if (item.kind !== "activity" || item.day === undefined) continue;
    add(item.day, {
      category: "stop",
      label: name(item.location, item.detail),
    });
  }

  for (const section of plan.sections) {
    const proposal = section.proposal;
    if (!proposal) continue;
    for (const flight of proposal.flights ?? []) {
      const outbound = timestamp(flight.depart);
      if (outbound !== undefined && outbound >= start && outbound <= end)
        add(tripDay(start, outbound), {
          category: "flight",
          label: `${flight.from} → ${flight.to}`,
        });
      const item = proposal.items.find((item) => item.selectionId === flight.id);
      const returning = timestamp(/returning (\d{4}-\d{2}-\d{2})/.exec(item?.detail ?? "")?.[1]);
      if (returning !== undefined && returning >= start && returning <= end)
        add(tripDay(start, returning), {
          category: "flight",
          label: `${flight.to} → ${flight.from}`,
        });
    }
    for (const item of proposal.items) {
      if (
        item.kind !== "flight" ||
        item.day === undefined ||
        proposal.flights?.some((flight) => flight.id === item.selectionId)
      )
        continue;
      add(item.day, {
        category: "flight",
        label: name(item.location, item.detail.split(/[:;]/)[0]),
      });
      const returning = timestamp(/returning (\d{4}-\d{2}-\d{2})/.exec(item.detail)?.[1]);
      if (returning !== undefined && returning >= start && returning <= end)
        add(tripDay(start, returning), {
          category: "flight",
          label: name(item.location, item.detail),
        });
    }
    for (const stay of proposal.stays ?? []) {
      const hotel =
        stay.candidates.find((candidate) => candidate.id === stay.selectedId)?.name ?? stay.city;
      const checkIn = timestamp(stay.checkIn);
      if (checkIn === undefined) continue;
      for (let night = 0; night < stay.nights; night += 1) {
        const time = checkIn + night * DAY_MS;
        if (time >= start && time <= end)
          add(tripDay(start, time), { category: "stay", label: hotel });
      }
    }
    for (const item of proposal.items) {
      if (
        item.kind !== "hotel" ||
        item.day === undefined ||
        proposal.stays?.some((stay) => stay.id === item.selectionId)
      )
        continue;
      const hotel = item.detail.split(" — ")[0]!.trim();
      const nights = Number(/(\d+) night/.exec(item.detail)?.[1] ?? 1);
      for (let night = 0; night < nights; night += 1)
        add(item.day + night, { category: "stay", label: hotel });
    }
  }
  return activities;
}

function monthRange(start: number, end: number) {
  const first = new Date(start);
  const last = new Date(end);
  const months = [];
  for (
    let time = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
    time <= end;
    time = Date.UTC(new Date(time).getUTCFullYear(), new Date(time).getUTCMonth() + 1, 1)
  )
    months.push({ time, last: time === Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1) });
  return months;
}

function categoryLabel(category: Activity["category"], locale: AppLocale) {
  if (category === "stop") return translate(locale, "Stops");
  if (category === "flight") return translate(locale, "Flight");
  return translate(locale, "Stay");
}

export function TripHomeCalendar({
  plan,
  onSelectDay,
  selectedDay,
}: {
  plan: TripPlan;
  onSelectDay(day: number): void;
  selectedDay?: number;
}) {
  const { locale } = useLocale();
  const intl = intlLocale(locale);
  const activities = useMemo(() => activitiesByDay(plan), [plan]);
  const start = timestamp(plan.brief.dates[0]);
  const end = timestamp(plan.brief.dates[1]);
  if (start === undefined || end === undefined || start > end) return null;

  const weekdays = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
  const dateLabel = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthLabel = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="trip-home-calendar">
      <div className="trip-home-calendar__legend" aria-label={translate(locale, "Trip details")}>
        {(["stop", "flight", "stay"] as const).map((category) => (
          <span data-category={category} key={category}>
            {category === "stop" ? (
              <FlowAttractionIcon size={14} />
            ) : category === "flight" ? (
              <FlowFlightIcon size={14} />
            ) : (
              <FlowStayIcon size={14} />
            )}
            {categoryLabel(category, locale)}
          </span>
        ))}
      </div>
      {monthRange(start, end).map(({ time }) => {
        const month = new Date(time);
        const year = month.getUTCFullYear();
        const monthIndex = month.getUTCMonth();
        const leading = (month.getUTCDay() + 6) % 7;
        const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        return (
          <section
            className="trip-home-calendar__month"
            key={time}
            aria-label={monthLabel.format(month)}
          >
            <h3>{monthLabel.format(month)}</h3>
            <div className="trip-home-calendar__weekdays" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index}>{weekdays.format(new Date(Date.UTC(2024, 0, 1 + index)))}</span>
              ))}
            </div>
            <div className="trip-home-calendar__grid">
              {Array.from({ length: leading }, (_, index) => (
                <span className="trip-home-calendar__blank" key={`blank-${index}`} />
              ))}
              {Array.from({ length: days }, (_, index) => {
                const timeForDate = time + index * DAY_MS;
                const day = tripDay(start, timeForDate);
                if (timeForDate < start || timeForDate > end)
                  return <span className="trip-home-calendar__blank" key={index + 1} />;
                const entries = activities.get(day) ?? [];
                const label = `${dateLabel.format(new Date(timeForDate))}${entries.length ? ` · ${entries.map((entry) => `${categoryLabel(entry.category, locale)}: ${entry.label}`).join(", ")}` : ""}`;
                return (
                  <button
                    className="trip-home-calendar__day"
                    type="button"
                    key={index + 1}
                    data-day={day}
                    data-activities={
                      [...new Set(entries.map((entry) => entry.category))].join(",") || undefined
                    }
                    aria-label={label}
                    aria-pressed={selectedDay === day || undefined}
                    onClick={() => onSelectDay(day)}
                  >
                    <span className="trip-home-calendar__date">{index + 1}</span>
                    <span className="trip-home-calendar__events">
                      {entries.map((entry, entryIndex) => (
                        <span
                          className="trip-home-calendar__event"
                          data-category={entry.category}
                          key={`${entry.category}-${entryIndex}`}
                        >
                          {entry.category === "stop" ? (
                            <FlowAttractionIcon size={12} />
                          ) : entry.category === "flight" ? (
                            <FlowFlightIcon size={12} />
                          ) : (
                            <FlowStayIcon size={12} />
                          )}
                          <span>{entry.label}</span>
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
