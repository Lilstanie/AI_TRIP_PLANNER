"use client";
import { useEffect, useRef } from "react";
import type { TripPlan } from "@trip/shared";
import { buildItinerary } from "@/lib/trip/itinerary";
import { dayCount, dayLabel } from "@/lib/trip/timeline";
import { useLocale } from "../account/LocaleProvider";

export function TripHomeItinerary({ plan, selectedDay }: { plan: TripPlan; selectedDay?: number }) {
  const { locale, t } = useLocale();
  const itinerary = buildItinerary(plan, () => undefined);
  const selected = useRef<HTMLElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [selectedDay]);
  return (
    <div className="trip-home-action itinerary">
      {Array.from({ length: dayCount(plan) }, (_, index) => index + 1).map((day) => {
        const stops = itinerary.stopsOn(day);
        return (
          <section
            className="trip-home-action__day"
            data-selected={selectedDay === day || undefined}
            ref={selectedDay === day ? selected : undefined}
            key={day}
            aria-label={dayLabel(plan, day, locale)}
          >
            <h3>
              {t("Day {v0}", { v0: day })} · {dayLabel(plan, day, locale)}
            </h3>
            {stops.length ? (
              <ol className="trip-home-action__list">
                {stops.map((stop) => (
                  <li key={stop.activity.id ?? `${stop.activity.detail}-${stop.number}`}>
                    <span className="trip-home-action__time">
                      {[stop.activity.startTime, stop.activity.endTime].filter(Boolean).join("–")}
                    </span>
                    <span>
                      <strong>{stop.activity.location?.trim() || stop.activity.detail}</strong>
                      <small>{stop.activity.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="trip-home-action__empty">
                {t("Nothing is scheduled on Day {day}.", { day })}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
