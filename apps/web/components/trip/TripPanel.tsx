"use client";
import type { ReactNode } from "react";
import type { TripPlan } from "@trip/shared";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { TripSection } from "./TripSection";
import { dayConnections } from "./ProposalDetails";
import { statusForPlan } from "@/lib/workspace/catalog";
import { itineraryActivities } from "@/lib/workspace";
import type { MessageKey } from "@/lib/i18n/locale";
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";

/**
 * The drawer's one-line state. A plan is "Needs review" only while it still
 * reports an unresolved revision request or a budget overrun; otherwise it is a
 * draft. Nothing can mark it confirmed, so that label is gone.
 */
export function tripStatus(plan: TripPlan) {
  if (!plan.sections.length) return "No plan yet";
  return statusForPlan(plan) === "needs_review" ? "Needs review" : "Draft";
}

/**
 * Body of the Your Trip drawer; the drawer supplies the heading and close button. One view: the budget,
 * then the day timeline (day strip, the day's stops, Ideas), then the trip's sections.
 */
export function TripPanel({
  plan,
  timeline,
  onReview,
  onEdit,
  onChoose,
  problem,
}: {
  plan: TripPlan;
  /** The day view: day strip, the chosen day's stops and Ideas. */
  timeline: ReactNode;
  onReview: () => void;
  onEdit: () => void;
  /** Swap a stay or fare inside a section; absent while the plan is busy. */
  onChoose?: (sectionId: string, selectionId: string, candidateId: string) => void;
  /** Why the last swap could not be made. */
  problem?: Notice;
}) {
  const { t, money, budgetGap, notice: localizeNotice } = useLocale();
  // Worked out by the itinerary specialist, shown by Getting around, which owns
  // every movement of the trip.
  const connections = dayConnections(plan.sections);
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
      {timeline}
      {problem && (
        <p className="item-problem" role="alert">
          {localizeNotice(problem)}
        </p>
      )}
      {plan.sections.length ? (
        <div className="trip-panel__sections">
          {plan.sections.map((section) => (
            <TripSection
              key={section.id}
              section={section}
              {...(section.id === "transport" ? { connections } : {})}
              {...(onChoose ? { onChoose } : {})}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        <p className="section__empty">
          {t("No itinerary yet. Fill in your preferences and select Update trip.")}
        </p>
      )}
      <div className="actions trip-panel__footer">
        <button className="primary" disabled={!plan.sections.length} onClick={onReview}>
          {t("Review plan")}
        </button>
      </div>
    </div>
  );
}
