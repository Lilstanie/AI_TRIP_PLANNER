"use client";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { ChevronIcon } from "@/components/ui/icons";
import { useScrollOverflow } from "@/components/ui/useScrollOverflow";
import { itineraryActivities, visitingOrder } from "@/lib/trip/itinerary";
import { dayCount, dayLabel, dayRows, emptyDayKey } from "@/lib/trip/timeline";

const SHOWN = 2;

export function PlanDays({
  plan,
  onOpenDay,
}: {
  plan: TripPlan;
  onOpenDay: (day: number) => void;
}) {
  const { t, locale } = useLocale();
  const { strip, more, scroll } = useScrollOverflow<HTMLOListElement>();
  const stops = visitingOrder(itineraryActivities(plan).filter((item) => item.day !== undefined));
  const days = Array.from({ length: dayCount(plan) }, (_, index) => {
    const day = index + 1;
    const names = [
      ...new Set(
        stops.filter((item) => item.day === day).map((item) => item.location ?? item.detail),
      ),
    ];
    const empty = names.length ? undefined : emptyDayKey(dayRows(plan, day, [], locale));
    return { day, date: dayLabel(plan, day, locale), names, empty };
  });
  return (
    <div
      className="plan-days-scroller"
      data-more-start={more.start || undefined}
      data-more-end={more.end || undefined}
    >
      <ol ref={strip} className="plan-days" aria-label={t("daysInThisPlan")}>
        {days.map(({ day, date, names, empty }, index) => (
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
                <span className="plan-day__free">{t(empty ?? "freeDay")}</span>
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
