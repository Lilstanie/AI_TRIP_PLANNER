import type { ReactNode } from "react";
import type { TripPlan } from "@trip/shared";
import { TripSection } from "./TripSection";
import { statusForPlan } from "@/lib/workspace/catalog";
import { budgetHint, money } from "@/lib/workspace";

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
  busy,
  tab,
  onTab,
  timeline,
  places,
  onReview,
  onEdit,
  onSave,
}: {
  plan: TripPlan;
  busy: boolean;
  tab: TripTab;
  onTab(tab: TripTab): void;
  timeline: ReactNode;
  /** The trip's places in visiting order, shown first in the Overview tab. */
  places?: ReactNode;
  onReview: () => void;
  onEdit: () => void;
  onSave: () => void;
}) {
  const estimated =
    Number.isFinite(plan.estTotal) && plan.estTotal >= 0 ? plan.estTotal : undefined;
  const budget =
    Number.isFinite(plan.budgetTotal) && plan.budgetTotal > 0 ? plan.budgetTotal : undefined;
  const pct =
    budget && estimated !== undefined ? Math.min(100, Math.round((estimated / budget) * 100)) : 0;
  const delta = budget && estimated !== undefined ? budget - estimated : undefined;
  const budgetState = delta === undefined ? "unavailable" : delta < 0 ? "over" : "within";
  const tabs: [TripTab, string][] = [
    ["overview", "Overview"],
    ["timeline", "Timeline & routes"],
  ];
  return (
    <div className="trip-panel">
      <p className="trip__sub">
        {plan.brief.destination} · {plan.brief.dates.join(" – ")} · {plan.brief.groupSize}{" "}
        {plan.brief.groupSize === 1 ? "traveller" : "travellers"}
      </p>
      <section className="trip-panel__budget-summary" aria-label="Trip budget">
        <div className="trip__budget-head">
          <div className="trip__budget">
            <span>Estimated total</span>
            <strong>{estimated === undefined ? "Estimate unavailable" : money(estimated)}</strong>
          </div>
          <span className={`budget-status budget-status--${budgetState}`}>
            {budgetState === "over"
              ? "Over budget"
              : budgetState === "within"
                ? "Within budget"
                : "Budget not set"}
          </span>
        </div>
        <div
          className={`bar${delta !== undefined && delta < 0 ? " bar--over" : ""}`}
          role="progressbar"
          aria-label="Budget used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <p
          className={`trip__budget-delta${delta !== undefined && delta < 0 ? " trip__budget-delta--over" : ""}`}
        >
          {delta === undefined
            ? "Budget not set"
            : `${money(Math.abs(delta))} ${delta < 0 ? "over" : "under"} the ${money(budget!)}${budgetHint(plan.brief)} budget`}
        </p>
      </section>
      <div className="trip-tabs" role="tablist" aria-label="Trip views">
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
            {label}
          </button>
        ))}
      </div>
      <div
        className="trip-tabpanel"
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
                  onReview={onReview}
                />
              ))
            ) : (
              <p className="section__empty">
                No itinerary yet. Fill in your preferences and select Update trip.
              </p>
            )}
          </>
        ) : (
          timeline
        )}
      </div>
      <div className="actions trip-panel__footer">
        <button className="primary" disabled={!plan.sections.length} onClick={onReview}>
          Review plan
        </button>
        <button disabled={busy || !plan.sections.length} onClick={onSave}>
          Save trip
        </button>
      </div>
    </div>
  );
}
