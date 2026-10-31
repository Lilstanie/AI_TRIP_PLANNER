"use client";
import { keyForText } from "@/lib/i18n/locale";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { placeConflicts } from "@/lib/trip/conflicts";
import { countUnpricedCosts, deriveBudgetCategories } from "@/lib/trip/budget";
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";
import { OnTripContext } from "@/lib/trip/on-trip-day";

export type TripPanelProps = {
  plan: TripPlan;
  timeline: ReactNode;
  problem?: Notice;
};

export function TripPanel({ plan, timeline, problem }: TripPanelProps) {
  const { t, money, notice: localizeNotice } = useLocale();
  const [onTrip, setOnTrip] = useState<boolean>();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const budgetManuallyChanged = useRef(false);
  const budgetTrip = useRef(plan.tripId);
  useEffect(() => {
    if (budgetTrip.current === plan.tripId) return;
    budgetTrip.current = plan.tripId;
    budgetManuallyChanged.current = false;
    setBudgetOpen(false);
  }, [plan.tripId]);
  useEffect(() => {
    if (!budgetManuallyChanged.current) setBudgetOpen(false);
  }, [onTrip]);
  const estimated =
    Number.isFinite(plan.estTotal) && plan.estTotal >= 0 ? plan.estTotal : undefined;
  const budget =
    Number.isFinite(plan.budgetTotal) && plan.budgetTotal > 0 ? plan.budgetTotal : undefined;
  const pct =
    budget && estimated !== undefined ? Math.min(100, Math.round((estimated / budget) * 100)) : 0;
  const hasLimit = budget !== undefined && estimated !== undefined;
  const atBudget = budget !== undefined && estimated === budget;
  const over = hasLimit && estimated > budget;
  const budgetBreakdown = deriveBudgetCategories(plan);
  const unpriced = countUnpricedCosts(budgetBreakdown);
  const transport = budgetBreakdown.find((category) => category.id === "transport");
  const transportMissing = !!transport && (transport.notCosted || transport.unpriced > 0);
  const unpricedCaution = unpriced > 0 && hasLimit && !over;
  const statusTone = !hasLimit
    ? "unavailable"
    : over
      ? "over"
      : unpricedCaution
        ? "caution"
        : "within";
  const statusText = !hasLimit
    ? t("budgetNotSet")
    : over
      ? t("overBudget")
      : atBudget
        ? transportMissing
          ? t("atBudgetUnpricedCostsNot")
          : unpriced > 0
            ? t("atBudgetUnpricedStopsNot")
            : t("atBudget")
        : unpricedCaution
          ? t("knownEstimateWithinBudgetUnpriced")
          : t("withinBudget");
  const budgetConflicts = placeConflicts(plan).budget;

  return (
    <OnTripContext.Provider value={setOnTrip}>
      <div className="trip-panel">
        <details
          className="disclosure trip-panel__budget-summary trip-budget"
          open={budgetOpen}
          onToggle={(event) => setBudgetOpen(event.currentTarget.open)}
        >
          <summary
            onClick={() => {
              budgetManuallyChanged.current = true;
            }}
          >
            <span className="sr-only">{t("tripBudget")}</span>
            <span className="trip-panel__budget-line">
              <span className="trip__budget">
                <strong>
                  {estimated === undefined ? t("estimateUnavailable") : money(estimated)}
                </strong>
                {budget !== undefined && <span>/ {money(budget, plan.brief.budgetSource)}</span>}
              </span>
              {unpriced > 0 && (
                <span className="trip-panel__budget-unknown">
                  {t("countUnpriced", { count: unpriced })}
                </span>
              )}
              <span className={`budget-status budget-status--${statusTone}`}>{statusText}</span>
            </span>
            <span
              className={`bar${over ? " bar--over" : ""}`}
              role="progressbar"
              aria-label={t("budgetUsed")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span style={{ width: `${pct}%` }} />
            </span>
          </summary>
          <ul className="trip-panel__budget-breakdown" aria-label={t("budgetBreakdown")}>
            {budgetBreakdown.map((category) => (
              <li key={category.id}>
                <span>{t(keyForText(category.label))}</span>
                <strong>{category.notCosted ? t("notCosted") : money(category.amount)}</strong>
              </li>
            ))}
          </ul>
          {budgetConflicts.length > 0 && (
            <ul className="trip-panel__conflicts" aria-label={t("openConflicts")}>
              {budgetConflicts.map((notice, index) => (
                <li key={index}>{localizeNotice(notice)}</li>
              ))}
            </ul>
          )}
        </details>
        <CurrencyNotice />
        {timeline}
        {problem && (
          <p className="item-problem" role="alert">
            {localizeNotice(problem)}
          </p>
        )}
        {!plan.sections.length && <p className="section__empty">{t("noItineraryYetFillIn")}</p>}
      </div>
    </OnTripContext.Provider>
  );
}
