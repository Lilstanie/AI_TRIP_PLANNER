"use client";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { TripRecord } from "@/lib/workspace/catalog";
import { ChevronIcon, PlusIcon } from "../ui/icons";
import { TripCover, coverColours } from "./TripCover";

type Tab = "trips" | "calendar";
const TABS: { id: Tab; label: string }[] = [
  { id: "trips", label: "Trips" },
  { id: "calendar", label: "Calendar" },
];

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const todayUtc = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};
const days = (trip: TripRecord) => {
  const [start, end] = trip.snapshot.plan.brief.dates;
  return Math.max(1, Math.round((utc(end) - utc(start)) / DAY) + 1);
};
const tripName = (trip: TripRecord) => `Trip to ${trip.snapshot.plan.brief.destination}`;

/**
 * Your trips, opened from the sidebar's Trips button as on Mindtrip: every saved trip as a card,
 * split into upcoming and past, and a Calendar tab that lays the trips over a month.
 */
export function TripsPage({
  trips,
  activeTripId,
  onOpenTrip,
  onNewTrip,
}: {
  trips: TripRecord[];
  activeTripId?: string;
  onOpenTrip(id: string): void;
  onNewTrip(): void;
}) {
  const [tab, setTab] = useState<Tab>("trips");
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "trips" ? "calendar" : "trips";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="trips-page">
      <div className="trips-page__inner">
        <header className="trips-page__head">
          <h1>Your trips</h1>
          <button type="button" className="trips-page__new" onClick={onNewTrip}>
            <PlusIcon />
            <span>New trip</span>
          </button>
        </header>
        <div className="trips-page__tabs" role="tablist" aria-label="Your trips">
          {TABS.map((item) => (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`trips-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`trips-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={onTabKey}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`trips-panel-${tab}`}
          aria-labelledby={`trips-tab-${tab}`}
          className="trips-page__panel"
        >
          {tab === "trips" ? (
            <TripCards trips={trips} activeTripId={activeTripId} onOpenTrip={onOpenTrip} />
          ) : (
            <TripCalendar trips={trips} onOpenTrip={onOpenTrip} />
          )}
        </div>
      </div>
    </div>
  );
}

function TripCards({
  trips,
  activeTripId,
  onOpenTrip,
}: {
  trips: TripRecord[];
  activeTripId?: string;
  onOpenTrip(id: string): void;
}) {
  const groups = useMemo(() => {
    const today = todayUtc();
    const byStart = [...trips].sort(
      (a, b) => utc(a.snapshot.plan.brief.dates[0]) - utc(b.snapshot.plan.brief.dates[0]),
    );
    return [
      {
        title: "Upcoming",
        items: byStart.filter((trip) => utc(trip.snapshot.plan.brief.dates[1]) >= today),
      },
      {
        title: "Past",
        items: byStart.filter((trip) => utc(trip.snapshot.plan.brief.dates[1]) < today).reverse(),
      },
    ].filter((group) => group.items.length);
  }, [trips]);

  if (!trips.length)
    return (
      <p className="trips-page__empty">
        No trips yet. Start one with New trip, or describe where you want to go in a chat.
      </p>
    );

  return groups.map((group) => (
    <section key={group.title} className="trips-page__group" aria-label={group.title}>
      <h2>{group.title}</h2>
      <ul className="trip-cards">
        {group.items.map((trip) => {
          const { destination } = trip.snapshot.plan.brief;
          const length = days(trip);
          return (
            <li key={trip.id}>
              <button
                type="button"
                className="trip-card"
                aria-current={trip.id === activeTripId ? "true" : undefined}
                onClick={() => onOpenTrip(trip.id)}
              >
                <TripCover destination={destination} size="card" />
                <span className="trip-card__text">
                  <span className="trip-card__title">{tripName(trip)}</span>
                  <span className="trip-card__meta">
                    {destination} · {length} {length === 1 ? "day" : "days"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  ));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1)),
  );

/** A month grid (weeks start on Monday) with each trip drawn over the days it covers. */
function TripCalendar({
  trips,
  onOpenTrip,
}: {
  trips: TripRecord[];
  onOpenTrip(id: string): void;
}) {
  // Open on the month of the next trip that has not ended, or this month.
  const [cursor, setCursor] = useState(() => {
    const today = todayUtc();
    const next = trips
      .map((trip) => trip.snapshot.plan.brief.dates)
      .filter(([, end]) => utc(end) >= today)
      .sort((a, b) => utc(a[0]) - utc(b[0]))[0];
    const date = new Date(next ? Math.max(utc(next[0]), today) : today);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  });
  const first = Date.UTC(cursor.year, cursor.month, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const monthDays = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + monthDays) / 7) * 7;
  const today = todayUtc();
  const shift = (by: number) =>
    setCursor(({ year, month }) => {
      const date = new Date(Date.UTC(year, month + by, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });

  const onDay = (time: number) =>
    trips.filter((trip) => {
      const [start, end] = trip.snapshot.plan.brief.dates;
      return time >= utc(start) && time <= utc(end);
    });

  return (
    <div className="trip-calendar">
      <div className="trip-calendar__head">
        <h2 aria-live="polite">{monthLabel(cursor.year, cursor.month)}</h2>
        <div className="trip-calendar__nav">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
            <span className="trip-calendar__prev">
              <ChevronIcon />
            </span>
          </button>
          <button
            type="button"
            className="trip-calendar__today"
            onClick={() => {
              const now = new Date(today);
              setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
            }}
          >
            Today
          </button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)}>
            <span className="trip-calendar__next">
              <ChevronIcon />
            </span>
          </button>
        </div>
      </div>
      <div
        className="trip-calendar__grid"
        role="grid"
        aria-label={monthLabel(cursor.year, cursor.month)}
      >
        <div role="row" className="trip-calendar__weekdays">
          {WEEKDAYS.map((day) => (
            <span role="columnheader" key={day}>
              {day}
            </span>
          ))}
        </div>
        {Array.from({ length: cells / 7 }, (_, week) => (
          <div role="row" className="trip-calendar__week" key={week}>
            {Array.from({ length: 7 }, (_, weekday) => {
              const index = week * 7 + weekday;
              const time = first + (index - lead) * DAY;
              const date = new Date(time);
              const inMonth = index >= lead && index < lead + monthDays;
              const here = onDay(time);
              return (
                <div
                  role="gridcell"
                  key={index}
                  className="trip-calendar__day"
                  data-outside={inMonth ? undefined : "true"}
                  data-today={time === today ? "true" : undefined}
                >
                  <span className="trip-calendar__date">{date.getUTCDate()}</span>
                  {here.map((trip) => {
                    const [start, end] = trip.snapshot.plan.brief.dates;
                    // Label the bar where it starts and at the start of each week it continues into.
                    const labelled = time === utc(start) || weekday === 0;
                    const [from, to] = coverColours(trip.snapshot.plan.brief.destination);
                    return (
                      <button
                        type="button"
                        key={trip.id}
                        className="trip-calendar__trip"
                        data-start={time === utc(start) ? "true" : undefined}
                        data-end={time === utc(end) ? "true" : undefined}
                        style={{ background: `color-mix(in srgb, ${from}, ${to})` }}
                        aria-label={`${tripName(trip)}, ${start} to ${end}`}
                        tabIndex={labelled ? 0 : -1}
                        onClick={() => onOpenTrip(trip.id)}
                      >
                        {labelled ? tripName(trip) : " "}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {!trips.length && (
        <p className="trips-page__empty">Trips you plan will appear on the calendar.</p>
      )}
    </div>
  );
}
