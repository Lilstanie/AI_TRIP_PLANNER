"use client";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { placeConflicts } from "@/lib/trip/conflicts";
import { countUnpricedCosts, deriveBudgetCategories } from "@/lib/trip/budget";
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";
import { OnTripContext } from "@/lib/trip/on-trip-day";
import { dateRangeLabel } from "@/lib/workspace/trip-facts";
import { tripCalendar, tripText } from "@/lib/trip/export";

export type TripPanelProps = {
  plan: TripPlan;
  timeline: ReactNode;
  problem?: Notice;
};

export function TripPanel({ plan, timeline, problem }: TripPanelProps) {
  const { t, locale, money, notice: localizeNotice } = useLocale();
  const [onTrip, setOnTrip] = useState<boolean>();
  const [exportMessage, setExportMessage] = useState("");
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
    ? t("Budget not set")
    : over
      ? t("Over budget")
      : atBudget
        ? transportMissing
          ? t("At budget · unpriced costs not counted")
          : unpriced > 0
            ? t("At budget · unpriced stops not counted")
            : t("At budget")
        : unpricedCaution
          ? t("Known estimate within budget · unpriced costs not counted")
          : t("Within budget");
  const budgetConflicts = placeConflicts(plan).budget;
  const [start, end] = plan.brief.dates;
  const dateRange = dateRangeLabel(start, end, locale) ?? `${start} – ${end}`;

  return (
    <OnTripContext.Provider value={setOnTrip}>
      <div className="trip-panel">
        <p className="trip__sub">
          {plan.brief.destination} · {dateRange} · {plan.brief.groupSize}{" "}
          {plan.brief.groupSize === 1 ? t("traveller") : t("travellers")}
        </p>
        <div className="trip-export">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(tripText(plan, locale));
                setExportMessage(t("Trip copied"));
              } catch {
                setExportMessage(t("Could not copy trip"));
              }
            }}
          >
            {t("Copy trip")}
          </button>
          <button
            type="button"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([tripCalendar(plan)], { type: "text/calendar;charset=utf-8" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "trip.ics";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            {t("Download calendar")}
          </button>
          <span role="status">{exportMessage}</span>
        </div>
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
            <span className="sr-only">{t("Trip budget")}</span>
            <span className="trip-panel__budget-line">
              <span className="trip__budget">
                <strong>
                  {estimated === undefined ? t("Estimate unavailable") : money(estimated)}
                </strong>
                {budget !== undefined && <span>/ {money(budget, plan.brief.budgetSource)}</span>}
              </span>
              {unpriced > 0 && (
                <span className="trip-panel__budget-unknown">
                  {t("{count} unpriced", { count: unpriced })}
                </span>
              )}
              <span className={`budget-status budget-status--${statusTone}`}>{statusText}</span>
            </span>
            <span
              className={`bar${over ? " bar--over" : ""}`}
              role="progressbar"
              aria-label={t("Budget used")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span style={{ width: `${pct}%` }} />
            </span>
          </summary>
          <ul className="trip-panel__budget-breakdown" aria-label={t("Budget breakdown")}>
            {budgetBreakdown.map((category) => (
              <li key={category.id}>
                <span>{t(category.label)}</span>
                <strong>{category.notCosted ? t("Not costed") : money(category.amount)}</strong>
              </li>
            ))}
          </ul>
          {budgetConflicts.length > 0 && (
            <ul className="trip-panel__conflicts" aria-label={t("Open conflicts")}>
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
        {!plan.sections.length && (
          <p className="section__empty">
            {t("No itinerary yet. Fill in your preferences and select Update trip.")}
          </p>
        )}
      </div>
    </OnTripContext.Provider>
  );
}
