"use client";
import { useEffect, useRef } from "react";
import type { TripPlan } from "@trip/shared";
import type { EditPreview } from "@/lib/trip/trip-edit";
import { formatDuration } from "@/lib/trip/timeline";
import { useLocale } from "../../account/LocaleProvider";

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
  const { t, money, delta, fare, budgetGap, locale, notice } = useLocale();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current?.focus(), []);
  const change = preview.plan.estTotal - plan.estTotal;
  const gap = budgetGap(
    preview.plan.estTotal,
    preview.plan.budgetTotal,
    preview.plan.brief.budgetSource,
  );
  const blocked = preview.blockerNotices.length > 0;
  // Problems the plan already had are in Review plan; here only what this change would add.
  const existing = new Set((plan.conflicts ?? []).map((conflict) => conflict.reason));
  const conflicts = (preview.plan.conflicts ?? []).filter((c) => !existing.has(c.reason));
  return (
    <div
      ref={root}
      tabIndex={-1}
      className="edit-preview"
      role="region"
      aria-label={t("Edit preview")}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <div className="edit-preview__head">
        <h3>{blocked ? t("This change can't be applied") : t("Review this change")}</h3>
        <p className="edit-preview__total">
          <strong>{money(preview.plan.estTotal)}</strong>{" "}
          <span className={change > 0 ? "is-up" : change < 0 ? "is-down" : undefined}>
            {change === 0 ? t("no change") : delta(change)}
          </span>
          {gap && <small>{t(gap.key, gap.params)}</small>}
        </p>
      </div>
      {blocked && (
        <ul className="edit-preview__list edit-preview__list--blockers" role="alert">
          {preview.blockerNotices.map((blocker, index) => (
            <li key={index}>{notice(blocker)}</li>
          ))}
        </ul>
      )}
      <ul className="edit-preview__list">
        {preview.differences.map(({ stop, days, before, after, placeChanged }, index) => (
          <li key={`${stop}-${index}`}>
            {days
              ? t("{stop}: day {fromDay} → day {toDay}, {before} → {after}", {
                  stop,
                  fromDay: days.from,
                  toDay: days.to,
                  before,
                  after,
                })
              : t("{stop}: {before} → {after}", { stop, before, after })}
            {placeChanged && t(" · place changed; price unverified")}
          </li>
        ))}
        {!preview.differences.length && !blocked && <li>{t("Stop order and routes updated.")}</li>}
      </ul>
      {!!preview.routes.length && (
        <div className="edit-preview__routes">
          <h4>{t("Routes checked")}</h4>
          <ul className="edit-preview__list">
            {preview.routes.map((route, index) => (
              <li key={`${route.from}-${route.to}-${index}`}>
                {route.status === "ok" && route.durationMin !== undefined
                  ? `${route.mode === "WALK" ? t("Walk") : t("Public transport")} · ${formatDuration(route.durationMin, locale)}`
                  : route.error
                    ? notice(route.error)
                    : t("No route found")}
                {route.fare
                  ? ` · ${fare(route.fare)}`
                  : route.status === "ok"
                    ? t(" · fare not published")
                    : ""}
              </li>
            ))}
          </ul>
          <p className="edit-preview__note">
            {t("Fares are in the provider's currency and are not added to the AUD budget.")}
          </p>
        </div>
      )}
      {!!conflicts.length && (
        <ul
          className="edit-preview__list edit-preview__list--conflicts"
          aria-label={t("New problems this change would leave")}
        >
          {conflicts.map((conflict) => (
            <li key={conflict.reason}>{conflict.reason}</li>
          ))}
        </ul>
      )}
      <div className="edit-preview__actions">
        <button type="button" className="primary" disabled={disabled || blocked} onClick={onApply}>
          {t("Apply changes")}
        </button>
        <button type="button" onClick={onCancel}>
          {blocked ? t("Close") : t("Cancel")}
        </button>
      </div>
    </div>
  );
}
