"use client";
import { useMemo } from "react";
import type { TripPlan, ProposalItem } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import type { TripPlaces } from "../map/useTripPlaces";
import { placeConflicts } from "@/lib/trip/conflicts";
import { deriveBudgetCategories } from "@/lib/trip/budget";
import { noticeText, readStoredNotice } from "@/lib/i18n/notice";

type IssueKind = "Time conflict" | "Unlocated place" | "Unpriced item" | "Place lookup failed";
type TripIssue = { kind: IssueKind; id?: string; day?: number; label: string; key: string };

function overlaps(a: ProposalItem, b: ProposalItem): boolean {
  if (a.day === undefined || a.day !== b.day || !a.startTime || !a.endTime || !b.startTime || !b.endTime)
    return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function TripIssues({
  plan,
  tripPlaces,
  onSelectStop,
  onSelectDay,
}: {
  plan: TripPlan;
  tripPlaces: TripPlaces;
  onSelectStop(id: string): void;
  onSelectDay(day: number): void;
}) {
  const { t, notice: localizeNotice } = useLocale();
  const issues = useMemo(() => {
    const found: TripIssue[] = [];
    const activities = plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
    const scheduled = plan.sections.flatMap((section) => section.proposal?.items ?? []);
    const budgetRows = deriveBudgetCategories(plan);
    activities.forEach((activity, index) => {
      const id = activity.id;
      const label = activity.detail;
      const key = id ?? `activity-${index}`;
      const overlapsItem = scheduled.some((other) => other !== activity && overlaps(activity, other));
      if (overlapsItem && activity.day !== undefined)
        found.push({ kind: "Time conflict", ...(id ? { id } : {}), day: activity.day, label, key: `time-${key}` });
      if (activity.day !== undefined && id) {
        const status = tripPlaces.locationStatus(activity);
        if (status === "unconfirmed")
          found.push({ kind: "Unlocated place", id, day: activity.day, label, key: `location-${key}` });
        if (status === "unavailable")
          found.push({ kind: "Place lookup failed", id, day: activity.day, label, key: `lookup-${key}` });
      }
      if (activity.estCost === undefined)
        found.push({ kind: "Unpriced item", ...(id ? { id } : {}), ...(activity.day === undefined ? {} : { day: activity.day }), label, key: `price-${key}` });
    });

    const knownConflictIds = new Set(found.filter((issue) => issue.kind === "Time conflict").map((issue) => issue.id));
    for (const [id, notices] of placeConflicts(plan).stops) {
      if (knownConflictIds.has(id)) continue;
      const isTimeConflict = notices.some((notice) =>
        /overlap/i.test(noticeText("en", notice)),
      );
      if (!isTimeConflict) continue;
      const activity = activities.find((item) => item.id === id);
      if (!activity) continue;
      found.push({ kind: "Time conflict", id, ...(activity.day === undefined ? {} : { day: activity.day }), label: activity.detail, key: `conflict-${id}-${notices.length}` });
    }

    for (const category of budgetRows) {
      for (const item of category.items.filter((entry) => entry.amount === undefined)) {
        if (item.day !== undefined || category.id === "itinerary") continue;
        found.push({ kind: "Unpriced item", ...(item.day === undefined ? {} : { day: item.day }), label: item.label, key: `price-${category.id}-${item.id}` });
      }
    }
    return found;
  }, [plan, tripPlaces]);
  if (!issues.length) return null;

  const groups: IssueKind[] = ["Time conflict", "Unlocated place", "Unpriced item", "Place lookup failed"];
  return (
    <section className="trip-issues" aria-label={t("Trip issues")}>
      <h3>{t("Trip issues")}</h3>
      {groups.map((kind) => {
        const entries = issues.filter((issue) => issue.kind === kind);
        if (!entries.length) return null;
        return (
          <div className="trip-issues__group" key={kind}>
            <h4>{t(kind)} · {entries.length}</h4>
            <ul>
              {entries.map((issue) => (
                <li key={issue.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (issue.day !== undefined) onSelectDay(issue.day);
                      if (issue.id) onSelectStop(issue.id);
                    }}
                    aria-label={`${t(kind)}: ${issue.label}`}
                  >
                    <span>{issue.label}</span>
                    {issue.day !== undefined && <span>{t("Day {v0}", { v0: issue.day })}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {plan.editIssues?.some((issue) => issue.code !== "price_unverified") && (
        <ul className="trip-issues__notices" aria-label={t("Other itinerary issues")}>
          {plan.editIssues
            .filter((issue) => issue.code !== "price_unverified")
            .map((issue, index) => <li key={`${issue.code}-${index}`}>{localizeNotice(readStoredNotice(issue.message))}</li>)}
        </ul>
      )}
    </section>
  );
}
