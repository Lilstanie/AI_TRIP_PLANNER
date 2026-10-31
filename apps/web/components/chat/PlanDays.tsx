"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { ChevronIcon } from "@/components/ui/icons";
import { motionAllowed } from "@/components/ui/motion";
import { itineraryActivities, visitingOrder } from "@/lib/trip/itinerary";
import { dayCount, dayLabel } from "@/lib/trip/timeline";

const SHOWN = 2;

function useOverflow() {
  const strip = useRef<HTMLOListElement>(null);
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const node = strip.current;
    if (!node) return;
    const measure = () => {
      const start = node.scrollLeft > 1;
      const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
      setMore((current) =>
        current.start === start && current.end === end ? current : { start, end },
      );
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);
  const scroll = (direction: 1 | -1) => {
    const node = strip.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: motionAllowed() ? "smooth" : "auto",
    });
  };
  return { strip, more, scroll };
}

export function PlanDays({
  plan,
  onOpenDay,
}: {
  plan: TripPlan;
  onOpenDay: (day: number) => void;
}) {
  const { t, locale } = useLocale();
  const { strip, more, scroll } = useOverflow();
  const stops = visitingOrder(itineraryActivities(plan).filter((item) => item.day !== undefined));
  const days = Array.from({ length: dayCount(plan) }, (_, index) => {
    const day = index + 1;
    const names = [
      ...new Set(
        stops.filter((item) => item.day === day).map((item) => item.location ?? item.detail),
      ),
    ];
    return { day, date: dayLabel(plan, day, locale), names };
  });
  return (
    <div
      className="plan-days-scroller"
      data-more-start={more.start || undefined}
      data-more-end={more.end || undefined}
    >
      <ol ref={strip} className="plan-days" aria-label={t("daysInThisPlan")}>
        {days.map(({ day, date, names }, index) => (
          <li key={day} className="plan-days__item" style={{ animationDelay: `${index * 50}ms` }}>
            <button
              type="button"
              className="plan-day"
              aria-label={t("openV0InTheTrip", { v0: t("dayV0", { v0: day }) })}
              onClick={() => onOpenDay(day)}
            >
              <span className="plan-day__head">
                <strong>{t("dayV0", { v0: day })}</strong>
                <span className="plan-day__date">{date}</span>
              </span>
              {names.length ? (
                <span className="plan-day__stops">
                  {names.slice(0, SHOWN).map((name) => (
                    <span key={name} className="plan-day__stop">
                      {name}
                    </span>
                  ))}
                  {names.length > SHOWN && (
                    <span className="plan-day__more">
                      {t("v0More", { v0: names.length - SHOWN })}
                    </span>
                  )}
                </span>
              ) : (
                <span className="plan-day__free">{t("freeDay")}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
      {more.start && (
        <button
          type="button"
          tabIndex={-1}
          className="plan-days__scroll plan-days__scroll--start"
          aria-label={t("earlierDays")}
          onClick={() => scroll(-1)}
        >
          <ChevronIcon />
        </button>
      )}
      {more.end && (
        <button
          type="button"
          tabIndex={-1}
          className="plan-days__scroll plan-days__scroll--end"
          aria-label={t("laterDays")}
          onClick={() => scroll(1)}
        >
          <ChevronIcon />
        </button>
      )}
    </div>
  );
}
