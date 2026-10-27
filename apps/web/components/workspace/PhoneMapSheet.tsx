"use client";
import { useRef, useState } from "react";
import { useLocale } from "../account/LocaleProvider";
import { dayCount } from "@/lib/trip/timeline";
import type { WorkspaceModel } from "./useWorkspace";

type Snap = "handle" | "half" | "full";
const snaps: Snap[] = ["handle", "half", "full"];
const names = {
  handle: "Resize day stops, collapsed",
  half: "Resize day stops, half height",
  full: "Resize day stops, full height",
} as const;

export function PhoneMapSheet({ model }: { model: WorkspaceModel }) {
  const { t } = useLocale();
  const [chosen, setSnap] = useState<Snap>();
  const drag = useRef<{ y: number; snap: Snap; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);

  const { itinerary, session } = model;
  const { mapDay: selectedDay } = model.layout;
  const days = session.plan
    ? Array.from({ length: dayCount(session.plan) }, (_, index) => index + 1)
    : [];
  const stops = selectedDay === undefined ? [] : itinerary.stopsOn(selectedDay);
  const empty = stops.length === 0;
  const snap = chosen ?? (empty ? "handle" : "half");
  const changeSnap = (step: number) =>
    setSnap(snaps[Math.max(0, Math.min(2, snaps.indexOf(snap) + step))]!);
  if (!session.plan) return null;
  return (
    <section
      className="phone-map-sheet"
      data-snap={snap}
      data-empty={empty || undefined}
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
        aria-label={t(names[snap])}
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
      {empty && <p className="phone-map-sheet__empty">{t("Nothing planned for this day yet.")}</p>}
      <div id="phone-map-stops" className="phone-map-sheet__body" hidden={snap === "handle"}>
        {days.length > 0 && (
          <div className="phone-map-sheet__days" role="group" aria-label={t("Choose map day")}>
            {days.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={value === selectedDay}
                onClick={() => model.layout.pickMapDay(value)}
              >
                {t("Day {v0}", { v0: value })}
              </button>
            ))}
          </div>
        )}
        {stops.length > 0 && (
          <ol className="phone-map-sheet__stops">
            {stops.map(({ activity: stop, number }, index) => {
              return (
                <li key={stop.id ?? index}>
                  <button
                    type="button"
                    aria-pressed={session.selectedActivity === stop.id}
                    onClick={() => {
                      if (stop.id) session.showStop(stop.id);

                      if (number !== undefined) setSnap("handle");
                    }}
                  >
                    {number !== undefined && (
                      <span className="phone-map-sheet__number" aria-hidden="true">
                        {number}
                      </span>
                    )}
                    <span>
                      <span className="phone-map-sheet__title">{stop.location ?? stop.detail}</span>
                      <small>
                        {[stop.startTime, number === undefined && t("Not found on the map")]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
