"use client";

import type { TripPlan } from "@trip/shared";
import { useLanguage } from "@/components/LanguageContext";
import { TripSection } from "@/components/TripSection";

const usd = (value: number) => `USD ${Math.round(value).toLocaleString()}`;

export function TripPanel({ plan, onReview }: { plan: TripPlan; onReview?: () => void }) {
  const { language, t } = useLanguage();
  const pct = plan.budgetTotal > 0 ? Math.min(100, (plan.estTotal / plan.budgetTotal) * 100) : 0;
  const delta = plan.budgetTotal - plan.estTotal;
  const overBudget = delta < 0;
  const pending = plan.hitl.filter((checkpoint) => checkpoint.status === "pending");
  const confirmedCost = plan.sections
    .filter((section) => section.status === "confirmed")
    .reduce((total, section) => total + section.estCost, 0);

  return (
    <section className="panel panel--right" aria-label="Trip decision timeline">
      <header className="trip-header">
        <span className="eyebrow">{t("Decision ledger")}</span>
        <h2>{t("Your trip plan")}</h2>
        <p>
          {plan.brief.destination} · {plan.brief.dates[0]} – {plan.brief.dates[1]} ·{" "}
          {plan.brief.groupSize}{" "}
          {language === "zh" ? "人" : plan.brief.groupSize === 1 ? "traveller" : "travellers"}
        </p>
      </header>

      <section className="budget-card" aria-label="Budget summary">
        <div className="budget-title">
          <span>{t("Total projected cost")}</span>
          <strong className={overBudget ? "risk risk--danger" : "risk risk--success"}>
            {t(overBudget ? "Over budget" : "On track")}
          </strong>
        </div>
        <div className="budget-total">
          {usd(plan.estTotal)}{" "}
          <small>
            / {t("Budget")} {usd(plan.budgetTotal)}
          </small>
        </div>
        <div className="budget-bar">
          <span
            className={`budget-fill ${overBudget ? "budget-fill--danger" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <dl className="budget-breakdown">
          <div>
            <dt>{t("Confirmed")}</dt>
            <dd>{usd(confirmedCost)}</dd>
          </div>
          <div>
            <dt>{language === "zh" ? "当前估算" : "Current estimate"}</dt>
            <dd>{usd(plan.estTotal)}</dd>
          </div>
          <div>
            <dt>{language === "zh" ? "规划轮次" : "Planning round"}</dt>
            <dd>{plan.round}</dd>
          </div>
          <div>
            <dt>{overBudget ? t("Over budget") : language === "zh" ? "剩余" : "Remaining"}</dt>
            <dd className={overBudget ? "overrun" : ""}>{usd(Math.abs(delta))}</dd>
          </div>
        </dl>
      </section>

      {pending.length > 0 && (
        <div className="decision-banner">
          <strong>{pending[0]!.title}</strong>
          <span>
            {pending.length === 1
              ? pending[0]!.detail
              : language === "zh"
                ? `${pending.length} ${t("decisions need you")}`
                : `${pending.length} ${t("decisions need you")}`}
          </span>
        </div>
      )}

      <ol className="timeline">
        {plan.sections.map((section, index) => (
          <TripSection section={section} index={index + 1} key={section.id} />
        ))}
      </ol>

      <button type="button" className="primary-button full-width review-plan" onClick={onReview}>
        {t("Review in chat")}
      </button>
      <p className="mock-disclosure">
        {t("No booking or payment is performed by this interface.")}
      </p>
    </section>
  );
}
