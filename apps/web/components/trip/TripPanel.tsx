"use client";
import { useRef, type ReactNode } from "react";
import type { TripPlan } from "@trip/shared";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { TripSection } from "./TripSection";
import { statusForPlan } from "@/lib/workspace/catalog";
import { itineraryActivities } from "@/lib/workspace";
import { useSegmentIndicator } from "../ui/motion";
import type { MessageKey } from "@/lib/i18n/locale";
import { useLocale } from "../account/LocaleProvider";

export type TripTab = "overview" | "timeline";

/**
 * The drawer's one-line state. A plan is "Needs review" only while it still
 * reports an unresolved revision request or a budget overrun; otherwise it is a
 * draft. Nothing can mark it confirmed, so that label is gone.
 */
export function tripStatus(plan: TripPlan) {
  if (!plan.sections.length) return "No plan yet";
  return statusForPlan(plan) === "needs_review" ? "Needs review" : "Draft";
}

/** Body of the Your Trip drawer; the drawer supplies the heading and close button. */
export function TripPanel({
  plan,
  tab,
  onTab,
  timeline,
  places,
  onReview,
  onEdit,
}: {
  plan: TripPlan;
  tab: TripTab;
  onTab(tab: TripTab): void;
  timeline: ReactNode;
  /** The trip's stops in visiting order, shown first in the Itinerary tab. */
  places?: ReactNode;
  onReview: () => void;
  onEdit: () => void;
}) {
  const { t, money, budgetGap } = useLocale();
  const estimated =
    Number.isFinite(plan.estTotal) && plan.estTotal >= 0 ? plan.estTotal : undefined;
  const budget =
    Number.isFinite(plan.budgetTotal) && plan.budgetTotal > 0 ? plan.budgetTotal : undefined;
  const pct =
    budget && estimated !== undefined ? Math.min(100, Math.round((estimated / budget) * 100)) : 0;
  const gap =
    estimated === undefined ? undefined : budgetGap(estimated, budget, plan.brief.budgetSource);
  const over = gap?.direction === "over";
  // Admission prices are published nowhere the planner can read, so these stops add nothing to the
  // total. Saying so keeps the total from reading as the whole cost of the trip.
  const unpriced = itineraryActivities(plan).filter((item) => item.estCost === undefined).length;
  const tabList = useRef<HTMLDivElement>(null);
  useSegmentIndicator(tabList, tab);
  const tabs: [TripTab, MessageKey][] = [
    ["overview", "Itinerary"],
    ["timeline", "Timeline & routes"],
  ];
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
        {unpriced > 0 && (
          <p className="trip__budget-note">
            {t("Not included: admission for {count} stops with no published price.", {
              count: unpriced,
            })}
          </p>
        )}
        <CurrencyNotice />
      </section>
      <div
        ref={tabList}
        className="trip-tabs segmented"
        role="tablist"
        aria-label={t("Trip views")}
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            id={`trip-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`trip-tabpanel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => onTab(id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              const next = tabs[(tabs.findIndex(([item]) => item === id) + 1) % tabs.length]![0];
              onTab(next);
              document.getElementById(`trip-tab-${next}`)?.focus();
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div
        key={tab}
        className="trip-tabpanel tab-panel-enter"
        role="tabpanel"
        id={`trip-tabpanel-${tab}`}
        aria-labelledby={`trip-tab-${tab}`}
      >
        {tab === "overview" ? (
          <>
            {places}
            {plan.sections.length ? (
              plan.sections.map((section) => (
                <TripSection
                  key={section.id}
                  section={section}
                  onEdit={onEdit}
                />
              ))
            ) : (
              <p className="section__empty">
                {t("No itinerary yet. Fill in your preferences and select Update trip.")}
              </p>
            )}
          </>
        ) : (
          timeline
        )}
      </div>
      <div className="actions trip-panel__footer">
        <button className="primary" disabled={!plan.sections.length} onClick={onReview}>
          {t("Review plan")}
        </button>
      </div>
    </div>
  );
}
