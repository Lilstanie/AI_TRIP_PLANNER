"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../account/LocaleProvider";
import { itineraryOrder } from "@/lib/map/itinerary-route";
import type { WorkspaceController } from "./useWorkspaceController";

type Snap = "handle" | "half" | "full";
const snaps: Snap[] = ["handle", "half", "full"];

/** Phone map's day selector and stops remain available even without a map provider key. */
export function PhoneMapSheet({
  model,
  day,
  onDayChange,
  onSelectStop,
}: {
  model: WorkspaceController;
  day?: number;
  onDayChange(day: number | undefined): void;
  onSelectStop?(id: string): void;
}) {
  const { t } = useLocale();
  const [snap, setSnap] = useState<Snap>("half");
  const drag = useRef<{ y: number; snap: Snap; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const activities = useMemo(
    // Ideas have no day and are not stops on the map.
    () =>
      itineraryOrder(model.tripPlaces.activities.filter((activity) => activity.day !== undefined)),
    [model.tripPlaces.activities],
  );
  // The number each located stop carries on its map marker and in its details; a repeat visit
  // carries its place's number.
  const orderFor = useMemo(
    () => new Map(model.tripPlaces.visits.map((visit) => [visit.activityId, visit.order])),
    [model.tripPlaces.visits],
  );
  const days = [...new Set(activities.map((activity) => activity.day!))].sort((a, b) => a - b);
  const selectedDay = days.includes(day ?? -1) ? day : days[0];
  useEffect(() => {
    if (selectedDay !== day) onDayChange(selectedDay);
  }, [selectedDay, day, onDayChange]);
  const stops = activities.filter((activity) => activity.day === selectedDay);
  const changeSnap = (step: number) =>
    setSnap((value) => snaps[Math.max(0, Math.min(2, snaps.indexOf(value) + step))]!);
  return (
    <section
      className="phone-map-sheet"
      data-snap={snap}
      aria-label={t("Day stops")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && snap !== "handle") {
          event.preventDefault();
          event.stopPropagation();
          setSnap("handle");
        }
      }}
    >
      <button
        type="button"
        className="phone-map-sheet__handle"
        aria-label={t("Resize day stops")}
        aria-expanded={snap !== "handle"}
        aria-controls="phone-map-stops"
        onClick={() => {
          if (ignoreClick.current) {
            ignoreClick.current = false;
            return;
          }
          setSnap(snaps[(snaps.indexOf(snap) + 1) % snaps.length]!);
        }}
        onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown", "Home", "End", "Escape"].includes(event.key)) {
            event.preventDefault();
            if (event.key === "Home" || event.key === "Escape") setSnap("handle");
            else if (event.key === "End") setSnap("full");
            else changeSnap(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
        onPointerDown={(event) => {
          drag.current = { y: event.clientY, snap, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current && Math.abs(event.clientY - drag.current.y) > 12)
            drag.current.moved = true;
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          drag.current = null;
          if (!start?.moved) return;
          ignoreClick.current = true;
          const delta = start.y - event.clientY;
          setSnap(
            snaps[Math.max(0, Math.min(2, snaps.indexOf(start.snap) + (delta > 0 ? 1 : -1)))]!,
          );
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <span aria-hidden="true" className="phone-map-sheet__grip" />
        <span>{t("Day stops")}</span>
      </button>
      <div id="phone-map-stops" className="phone-map-sheet__body" hidden={snap === "handle"}>
        {days.length > 0 && (
          <div className="phone-map-sheet__days" role="group" aria-label={t("Choose map day")}>
            {days.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={value === selectedDay}
                onClick={() => {
                  onDayChange(value);
                  model.setSelectedActivity(undefined);
                }}
              >
                {t("Day {v0}", { v0: value })}
              </button>
            ))}
          </div>
        )}
        {stops.length > 0 ? (
          <ol className="phone-map-sheet__stops">
            {stops.map((stop, index) => {
              const order = stop.id ? orderFor.get(stop.id) : undefined;
              return (
                <li key={stop.id ?? index}>
                  <button
                    type="button"
                    aria-pressed={model.selectedActivity === stop.id}
                    onClick={() => {
                      if (stop.id) (onSelectStop ?? model.setSelectedActivity)(stop.id);
                      // A stop without a map location has nothing to centre on, so the list stays.
                      if (order !== undefined) setSnap("handle");
                    }}
                  >
                    <span className="phone-map-sheet__number" aria-hidden="true">
                      {order ?? ""}
                    </span>
                    <span>
                      {stop.detail}
                      <small>
                        {stop.startTime}
                        {stop.location ? ` · ${stop.location}` : ""}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="phone-map-sheet__empty">
            {t("Plan a trip in Chat to see your day stops here.")}
          </p>
        )}
      </div>
    </section>
  );
}
