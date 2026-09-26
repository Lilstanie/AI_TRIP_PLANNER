"use client";
import { useEffect, useRef } from "react";
import type { TripPlan } from "@trip/shared";
import type { EditPreview } from "@/lib/trip/trip-edit";
import { formatDuration } from "@/lib/trip/timeline";
import { money } from "@/lib/workspace";

/**
 * "Review this change": what an edit does to the trip before it is applied — the new total and the
 * difference, what moved, the routes checked, and anything that stops it. It takes focus when it
 * opens and Escape closes only the preview, not the drawer around it.
 */
export function EditPreviewPanel({
  plan,
  preview,
  disabled,
  onApply,
  onCancel,
}: {
  plan: TripPlan;
  preview: EditPreview;
  disabled: boolean;
  onApply(): void;
  onCancel(): void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current?.focus(), []);
  const change = preview.plan.estTotal - plan.estTotal;
  const left = preview.plan.budgetTotal - preview.plan.estTotal;
  const blocked = preview.blockers.length > 0;
  // Problems the plan already had are in Review plan; here only what this change would add.
  const existing = new Set((plan.conflicts ?? []).map((conflict) => conflict.reason));
  const conflicts = (preview.plan.conflicts ?? []).filter((c) => !existing.has(c.reason));
  return (
    <div
      ref={root}
      tabIndex={-1}
      className="edit-preview"
      role="region"
      aria-label="Edit preview"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <div className="edit-preview__head">
        <h3>{blocked ? "This change can't be applied" : "Review this change"}</h3>
        <p className="edit-preview__total">
          <strong>{money(preview.plan.estTotal)}</strong>{" "}
          <span className={change > 0 ? "is-up" : change < 0 ? "is-down" : undefined}>
            {change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${money(Math.abs(change))}`}
          </span>
          <small>
            {left >= 0 ? `${money(left)} left in budget` : `${money(-left)} over budget`}
          </small>
        </p>
      </div>
      {!!preview.blockers.length && (
        <ul className="edit-preview__list edit-preview__list--blockers" role="alert">
          {preview.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
      <ul className="edit-preview__list">
        {preview.differences.map((difference) => (
          <li key={difference}>{difference}</li>
        ))}
        {!preview.differences.length && !blocked && <li>Stop order and routes updated.</li>}
      </ul>
      {!!preview.routes.length && (
        <div className="edit-preview__routes">
          <h4>Routes checked</h4>
          <ul className="edit-preview__list">
            {preview.routes.map((route, index) => (
              <li key={`${route.from}-${route.to}-${index}`}>
                {route.status === "ok" && route.durationMin !== undefined
                  ? `${route.mode === "WALK" ? "Walk" : "Public transport"} · ${formatDuration(route.durationMin)}`
                  : (route.error ?? "No route found")}
                {route.fare
                  ? ` · ${route.fare.currency} ${route.fare.amount.toFixed(2)}`
                  : route.status === "ok"
                    ? " · fare not published"
                    : ""}
              </li>
            ))}
          </ul>
          <p className="edit-preview__note">
            Fares are in the provider&apos;s currency and are not added to the AUD budget.
          </p>
        </div>
      )}
      {!!conflicts.length && (
        <ul
          className="edit-preview__list edit-preview__list--conflicts"
          aria-label="New problems this change would leave"
        >
          {conflicts.map((conflict) => (
            <li key={conflict.reason}>{conflict.reason}</li>
          ))}
        </ul>
      )}
      <div className="edit-preview__actions">
        <button type="button" className="primary" disabled={disabled || blocked} onClick={onApply}>
          Apply changes
        </button>
        <button type="button" onClick={onCancel}>
          {blocked ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
