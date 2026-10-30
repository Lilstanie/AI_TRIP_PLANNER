"use client";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { itineraryActivities, visitingOrder } from "@/lib/trip/itinerary";
import { dayCount, dayLabel } from "@/lib/trip/timeline";

const SHOWN = 2;

export function PlanDays({
  plan,
  onOpenDay,
}: {
  plan: TripPlan;
  onOpenDay: (day: number) => void;
}) {
  const { t, locale } = useLocale();
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
    <ol className="plan-days" aria-label={t("Days in this plan")}>
      {days.map(({ day, date, names }, index) => (
        <li key={day} className="plan-days__item" style={{ animationDelay: `${index * 50}ms` }}>
          <button
            type="button"
            className="plan-day"
            aria-label={t("Open {v0} in the trip", { v0: t("Day {v0}", { v0: day }) })}
            onClick={() => onOpenDay(day)}
          >
            <span className="plan-day__head">
              <strong>{t("Day {v0}", { v0: day })}</strong>
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
                    {t("+{v0} more", { v0: names.length - SHOWN })}
                  </span>
                )}
              </span>
            ) : (
              <span className="plan-day__free">{t("Free day")}</span>
            )}
          </button>
        </li>
      ))}
    </ol>
  );
}
