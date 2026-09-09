"use client";

// Owner: E — the redesigned "Your trip" panel.
// Data comes straight from the aggregated TripPlan (see @trip/orchestrator).
import type { TripPlan } from "@trip/shared";
import { TripSection } from "@/components/TripSection";

export function TripPanel({ plan }: { plan: TripPlan }) {
  const pct = Math.min(100, Math.round((plan.estTotal / plan.budgetTotal) * 100));
  const delta = plan.budgetTotal - plan.estTotal;
  const pendingHitl = plan.hitl.filter((h) => h.status === "pending");

  function reviewPlan() {
    const checkpoint = document.querySelector<HTMLElement>("[data-hitl-pending]");
    checkpoint?.scrollIntoView({ behavior: "smooth", block: "center" });
    checkpoint?.focus({ preventScroll: true });
  }

  return (
    <section className="panel panel--right">
      <div className="trip__head">
        <h2 style={{ margin: 0 }}>Your trip</h2>
        <span style={{ fontSize: 12, color: "var(--text-mut)" }}>
          {plan.round > 1 ? `Round ${plan.round} · ` : ""}Plan {plan.planVersion.slice(0, 8)}
        </span>
      </div>
      <p className="trip__sub">
        {plan.brief.destination} · {plan.brief.dates[0]} – {plan.brief.dates[1]} ·{" "}
        {plan.brief.groupSize} people
      </p>

      {/* one budget bar, top only */}
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}
      >
        <span style={{ color: "var(--text-dim)" }}>Budget</span>
        <span>
          <strong>${plan.estTotal.toLocaleString()}</strong>{" "}
          <span style={{ color: "var(--text-mut)" }}>/ ${plan.budgetTotal.toLocaleString()}</span>
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p style={{ fontSize: 12, color: "var(--ok)", margin: "6px 0 4px" }}>
        {delta >= 0
          ? `$${delta.toLocaleString()} under budget`
          : `$${(-delta).toLocaleString()} over budget`}
      </p>

      {pendingHitl.length > 0 && (
        <div className="banner">
          <span>
            <strong>{pendingHitl[0]!.title}</strong>
            <br />
            {pendingHitl.length} of {plan.sections.length} things need you
          </span>
        </div>
      )}

      <div>
        {plan.sections.map((s) => (
          <TripSection key={s.id} section={s} />
        ))}
      </div>

      <button
        className="trip__cta"
        type="button"
        onClick={reviewPlan}
        disabled={!pendingHitl.length}
      >
        {pendingHitl.length
          ? `Review ${pendingHitl.length} decision${pendingHitl.length === 1 ? "" : "s"}`
          : "Plan reviewed"}
      </button>
    </section>
  );
}
