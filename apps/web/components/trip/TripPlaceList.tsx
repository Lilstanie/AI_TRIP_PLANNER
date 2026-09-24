"use client";
import { useEffect, useMemo, useRef } from "react";
import { itineraryOrder } from "@/lib/map/itinerary-route";
import type { TripPlaces } from "../map/useTripPlaces";

function dayDate(start: string, day: number) {
  const time = Date.parse(start);
  if (!Number.isFinite(time)) return undefined;
  return new Date(time + (day - 1) * 86400000).toISOString().slice(0, 10);
}

/**
 * The trip's places in visiting order, grouped by day, at the top of the Overview tab. It is the
 * keyboard path to every map marker: a located stop is a button that selects it on the map and
 * opens its place details, and a marker pressed on the map marks its row here.
 */
export function TripPlaceList({
  tripPlaces,
  startDate,
  selected,
  onSelect,
}: {
  tripPlaces: TripPlaces;
  startDate: string;
  selected?: string;
  onSelect(activityId: string): void;
}) {
  const { activities, markers, places, placeIdFor, locationStatus } = tripPlaces;
  const list = useRef<HTMLElement>(null);
  const orderFor = useMemo(
    () => new Map(markers.map((marker) => [marker.activityId, marker.order])),
    [markers],
  );
  const days = useMemo(() => {
    const groups = new Map<number | undefined, typeof activities>();
    for (const activity of itineraryOrder(activities)) {
      const group = groups.get(activity.day) ?? [];
      group.push(activity);
      groups.set(activity.day, group);
    }
    return [...groups];
  }, [activities]);

  // A marker chosen on the map scrolls its row into view without taking focus.
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    row?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  if (!activities.length) return null;
  return (
    <section className="trip-places" aria-labelledby="trip-places-title" ref={list}>
      <h3 id="trip-places-title">Places</h3>
      {days.map(([day, items]) => {
        const date = day === undefined ? undefined : dayDate(startDate, day);
        const title = day === undefined ? "Unscheduled" : `Day ${day}${date ? ` · ${date}` : ""}`;
        return (
          <div className="trip-places__day" key={day ?? "none"}>
            <h4>{title}</h4>
            <ol aria-label={`Places, ${title}`}>
              {items.map((activity, index) => {
                const placeId = placeIdFor(activity);
                const place = placeId ? places[placeId] : undefined;
                const order = activity.id ? orderFor.get(activity.id) : undefined;
                const time = activity.startTime
                  ? `${activity.startTime}${activity.endTime ? `–${activity.endTime}` : ""}`
                  : undefined;
                const name = place?.displayName?.text ?? activity.location ?? activity.detail;
                const status = locationStatus(activity);
                return (
                  <li key={activity.id ?? `${day}-${index}`}>
                    {order !== undefined && activity.id ? (
                      <button
                        type="button"
                        className="trip-places__stop"
                        aria-pressed={selected === activity.id}
                        onClick={() => onSelect(activity.id!)}
                      >
                        <span className="trip-places__order" aria-hidden="true">
                          {order}
                        </span>
                        <span className="trip-places__text">
                          <span className="trip-places__name">
                            <span className="sr-only">Stop {order}: </span>
                            {name}
                          </span>
                          <small>
                            {[time, activity.detail !== name && activity.detail]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </button>
                    ) : (
                      <div className="trip-places__stop trip-places__stop--unmapped">
                        <span className="trip-places__order" aria-hidden="true" />
                        <span className="trip-places__text">
                          <span className="trip-places__name">{name}</span>
                          <small>
                            {[
                              time,
                              status === "loading"
                                ? "Finding this place…"
                                : status === "unavailable"
                                  ? "Place could not be loaded right now"
                                  : "Location to be confirmed",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
