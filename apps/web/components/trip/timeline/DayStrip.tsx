"use client";
import { useEffect, useRef } from "react";

/**
 * The trip's days as tabs: "Day 2 · Sun 18 Oct · 3 stops". Arrow keys move between days, the
 * selected day scrolls into view, and the strip scrolls sideways on a narrow screen instead of
 * wrapping into a second row.
 */
export function DayStrip({
  days,
  selected,
  onSelect,
}: {
  days: { day: number; date: string; stops: number; attention: boolean }[];
  selected: number;
  onSelect(day: number): void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected]);
  const move = (to: number) => {
    const next = Math.min(Math.max(1, to), days.length);
    onSelect(next);
    strip.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
  };
  return (
    <div className="day-strip" role="tablist" aria-label="Trip days" ref={strip}>
      {days.map(({ day, date, stops, attention }) => (
        <button
          key={day}
          type="button"
          role="tab"
          data-day={day}
          className="day-strip__day"
          aria-selected={day === selected}
          tabIndex={day === selected ? 0 : -1}
          onClick={() => onSelect(day)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") move(day + 1);
            else if (event.key === "ArrowLeft") move(day - 1);
            else if (event.key === "Home") move(1);
            else if (event.key === "End") move(days.length);
            else return;
            event.preventDefault();
          }}
        >
          <span className="day-strip__title">Day {day}</span>
          <span className="day-strip__date">{date}</span>
          <span className="day-strip__meta">
            {stops ? `${stops} ${stops === 1 ? "stop" : "stops"}` : "Free day"}
            {attention && (
              <span className="day-strip__flag">
                <span aria-hidden="true"> · </span>needs a place
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
