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
import type { TripPlaces } from "../map/useTripPlaces";
import { TripIssues } from "./TripIssues";

export type TripPanelProps = {
  plan: TripPlan;
  timeline: ReactNode;
  problem?: Notice;
} & (
  | {
      tripPlaces: TripPlaces;
      onSelectStop(id: string): void;
      onSelectDay(day: number): void;
    }
  | {
      tripPlaces?: undefined;
      onSelectStop?: never;
      onSelectDay?: never;
    }
);

export function TripPanel({ plan, timeline, problem, ...issueNavigation }: TripPanelProps) {
  const { t, locale, money, budgetGap, notice: localizeNotice } = useLocale();
  const [onTrip, setOnTrip] = useState<boolean>();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [pendingBudgetItem, setPendingBudgetItem] = useState<string>();
  const budgetItemRefs = useRef(new Map<string, HTMLLIElement>());
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
  const gap =
    estimated === undefined ? undefined : budgetGap(estimated, budget, plan.brief.budgetSource);
  const atBudget = budget !== undefined && estimated === budget;
  const over = gap?.direction === "over";
  const budgetBreakdown = deriveBudgetCategories(plan);
  const unpriced = countUnpricedCosts(budgetBreakdown);
  const transport = budgetBreakdown.find((category) => category.id === "transport");
  const transportMissing = !!transport && (transport.notCosted || transport.unpriced > 0);
  const unpricedCaution = unpriced > 0 && (atBudget || gap?.direction === "under");
  const budgetConflicts = placeConflicts(plan).budget;
  const [start, end] = plan.brief.dates;
  const dateRange = dateRangeLabel(start, end, locale) ?? `${start} – ${end}`;
  const issueProps =
    "tripPlaces" in issueNavigation && issueNavigation.tripPlaces ? issueNavigation : undefined;
  useEffect(() => {
    if (!budgetOpen || !pendingBudgetItem) return;
    const item = budgetItemRefs.current.get(pendingBudgetItem);
    if (!item) return;
    item.scrollIntoView({ block: "nearest" });
    item.focus({ preventScroll: true });
    setPendingBudgetItem(undefined);
  }, [budgetOpen, pendingBudgetItem]);

  const selectBudgetItem = (categoryId: string, itemId: string) => {
    setPendingBudgetItem(`${categoryId}\u0000${itemId}`);
    setBudgetOpen(true);
  };

  return (
    <OnTripContext.Provider value={setOnTrip}>
      <div className="trip-panel">
        <p className="trip__sub">
          {plan.brief.destination} · {dateRange} · {plan.brief.groupSize}{" "}
          {plan.brief.groupSize === 1 ? t("traveller") : t("travellers")}
        </p>
        <details
          className="trip-panel__budget-summary trip-budget"
          open={budgetOpen}
          onToggle={(event) => setBudgetOpen(event.currentTarget.open)}
        >
          <summary
            onClick={() => {
              budgetManuallyChanged.current = true;
            }}
          >
            <span className="trip-panel__budget-title">{t("Trip budget")}</span>
            <span className="trip-panel__budget-compact">
              <span>
                <span>{t("Estimated total")}</span>
                <strong>
                  {estimated === undefined ? t("Estimate unavailable") : money(estimated)}
                </strong>
              </span>
              <span>
                <span>{t("Budget limit")}</span>
                <strong>
                  {budget === undefined
                    ? t("Budget not set")
                    : money(budget, plan.brief.budgetSource)}
                </strong>
              </span>
              {(unpriced > 0 || transportMissing) && (
                <span className="trip-panel__budget-unknown">
                  {t("{count} unpriced", { count: unpriced })}
                </span>
              )}
              <span
                className={`budget-status budget-status--${!gap ? "unavailable" : over ? "over" : unpricedCaution ? "caution" : "within"}`}
              >
                {!gap
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
                        : t("Within budget")}
              </span>
            </span>
          </summary>
          <div className="trip__budget-head">
            <div className="trip__budget">
              <span>{t("Estimated total")}</span>
              <strong>
                {estimated === undefined ? t("Estimate unavailable") : money(estimated)}
              </strong>
            </div>
            <span
              className={`budget-status budget-status--${!gap ? "unavailable" : over ? "over" : unpricedCaution ? "caution" : "within"}`}
            >
              {!gap
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
                      : t("Within budget")}
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
            {atBudget
              ? t("The known estimate equals your budget.")
              : gap
                ? t(gap.key, gap.params)
                : t("Budget not set")}
          </p>
          <ul className="trip-panel__budget-breakdown" aria-label={t("Budget breakdown")}>
            {budgetBreakdown.map((category) => (
              <li key={category.id}>
                <div className="trip-panel__budget-category">
                  <span>{t(category.label)}</span>
                  <span>
                    {category.notCosted ? (
                      <strong>{t("Not costed")}</strong>
                    ) : (
                      <>
                        <strong>{money(category.amount)}</strong> · {t("Estimated")}
                      </>
                    )}
                    {category.unpriced > 0 && (
                      <> · {t("{count} unpriced", { count: category.unpriced })}</>
                    )}
                  </span>
                </div>
                {category.items.length > 0 && (
                  <ul aria-label={t("{category} items", { category: t(category.label) })}>
                    {category.items.map((item) => (
                      <li
                        key={item.id}
                        tabIndex={-1}
                        ref={(node) => {
                          const key = `${category.id}\u0000${item.id}`;
                          if (node) budgetItemRefs.current.set(key, node);
                          else budgetItemRefs.current.delete(key);
                        }}
                      >
                        <span>{item.label}</span>
                        <span>
                          {item.amount === undefined ? t("Price unknown") : money(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
          {unpriced > 0 && (
            <p className="trip__budget-note">
              {t("Not included: costs for stops without a published price ({count}).", {
                count: unpriced,
              })}
            </p>
          )}
          {transportMissing && (
            <p className="trip__budget-note">{t("Not included: transport without a price.")}</p>
          )}
        </details>
        <CurrencyNotice />
        {issueProps && (
          <TripIssues
            plan={plan}
            tripPlaces={issueProps.tripPlaces}
            onSelectStop={issueProps.onSelectStop}
            onSelectDay={issueProps.onSelectDay}
            onSelectBudgetItem={selectBudgetItem}
          />
        )}
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
