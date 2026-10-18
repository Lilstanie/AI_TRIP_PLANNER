"use client";
import type { ReactNode } from "react";
import type { TripPlan } from "@trip/shared";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { itineraryActivities } from "@/lib/workspace";
import { restaurantIds } from "@/lib/trip/restaurants";
import { placeConflicts } from "@/lib/trip/conflicts";
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";

export function TripPanel({
  plan,
  timeline,
  problem,
}: {
  plan: TripPlan;

  timeline: ReactNode;

  problem?: Notice;
}) {
  const { t, money, budgetGap, notice: localizeNotice } = useLocale();
  const estimated =
    Number.isFinite(plan.estTotal) && plan.estTotal >= 0 ? plan.estTotal : undefined;
  const budget =
    Number.isFinite(plan.budgetTotal) && plan.budgetTotal > 0 ? plan.budgetTotal : undefined;
  const pct =
    budget && estimated !== undefined ? Math.min(100, Math.round((estimated / budget) * 100)) : 0;
  const gap =
    estimated === undefined ? undefined : budgetGap(estimated, budget, plan.brief.budgetSource);
  const over = gap?.direction === "over";

  const picks = restaurantIds(plan);
  const budgetConflicts = placeConflicts(plan).budget;
  const unpriced = itineraryActivities(plan).filter(
    (item) => item.estCost === undefined && !(item.id && picks.has(item.id)),
  ).length;
  return (
    <div className="trip-panel">
      <p className="trip__sub">
        {plan.brief.destination} · {plan.brief.dates.join(" – ")} · {plan.brief.groupSize}{" "}
        {plan.brief.groupSize === 1 ? t("traveller") : t("travellers")}
      </p>
      <section className="trip-panel__budget-summary" aria-label={t("Trip budget")}>
        <div className="trip__budget-head">
          <div className="trip__budget">
            <span>{t("Estimated total")}</span>
            <strong>
              {estimated === undefined ? t("Estimate unavailable") : money(estimated)}
            </strong>
          </div>
          <span
            className={`budget-status budget-status--${!gap ? "unavailable" : over ? "over" : "within"}`}
          >
            {!gap ? t("Budget not set") : over ? t("Over budget") : t("Within budget")}
          </span>
        </div>
        <div
          className={`bar${over ? " bar--over" : ""}`}
          role="progressbar"
          aria-label={t("Budget used")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className={`trip__budget-delta${over ? " trip__budget-delta--over" : ""}`}>
          {gap ? t(gap.key, gap.params) : t("Budget not set")}
        </p>
        {budgetConflicts.length > 0 && (
          <ul className="trip-panel__conflicts" aria-label={t("Open conflicts")}>
            {budgetConflicts.map((notice, index) => (
              <li key={index}>{localizeNotice(notice)}</li>
            ))}
          </ul>
        )}
        {unpriced > 0 && (
          <p className="trip__budget-note">
            {t("Not included: admission for {count} stops with no published price.", {
              count: unpriced,
            })}
          </p>
        )}
        <CurrencyNotice />
      </section>
      {timeline}
      {problem && (
        <p className="item-problem" role="alert">
          {localizeNotice(problem)}
        </p>
      )}
      {!plan.sections.length && (
        <p className="section__empty">
          {t("No itinerary yet. Fill in your preferences and select Update trip.")}
        </p>
      )}
    </div>
  );
}
