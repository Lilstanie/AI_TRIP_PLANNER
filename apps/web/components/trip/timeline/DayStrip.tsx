"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useEffect, useRef } from "react";

export function DayStrip({
  days,
  selected,
  today,
  panelId,
  dropDay,
  onSelect,
}: {
  days: {
    day: number;
    date: string;
    stops: number;
    empty: "flight" | "booked" | "freeDay";
    attention: boolean;
  }[];
  selected: number;
  today?: number;
  panelId: string;
  dropDay?: number;
  onSelect(day: number): void;
}) {
  const { t } = useLocale();
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = strip.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active) return;
    const bounds = list.getBoundingClientRect();
    const day = active.getBoundingClientRect();
    if (day.left < bounds.left) list.scrollLeft += day.left - bounds.left;
    else if (day.right > bounds.right) list.scrollLeft += day.right - bounds.right;
  }, [selected]);
  const move = (to: number) => {
    const next = Math.min(Math.max(1, to), days.length);
    onSelect(next);
    strip.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
  };
  return (
    <div className="day-strip" role="tablist" aria-label={t("tripDays")} ref={strip}>
      {days.map(({ day, date, stops, empty, attention }) => (
        <button
          key={day}
          type="button"
          role="tab"
          data-day={day}
          data-drop-zone={`day:${day}`}
          data-drop-end=""
          {...(dropDay === day ? { "data-drop-target": "true" } : {})}
          id={`${panelId}-day-tab-${day}`}
          className="day-strip__day"
          aria-controls={panelId}
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
          <span className="day-strip__title">{t("dayV0", { v0: day })}</span>
          {day === today && <span className="day-strip__today">{t("today")}</span>}
          <span className="day-strip__date">{date}</span>
          <span className="day-strip__meta">
            {stops ? t("dayStopCount", { count: stops }) : t(empty)}
            {attention && (
              <span className="day-strip__flag">
                <span aria-hidden="true"> · </span>
                {t("needsAPlace")}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
