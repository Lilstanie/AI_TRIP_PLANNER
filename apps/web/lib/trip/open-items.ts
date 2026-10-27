import type { ProposalItem, TripPlan } from "@trip/shared";
import type { TripPlaces } from "@/components/map/useTripPlaces";
import { placeConflicts } from "./conflicts";
import { noticeText } from "@/lib/i18n/notice";

export type OpenItemKind = "Time conflict" | "Unlocated place" | "Place lookup failed";

export type OpenItem = {
  kind: OpenItemKind;
  stopId: string;
  label: string;
  key: string;
};

export const OPEN_ITEM_KINDS: readonly OpenItemKind[] = [
  "Time conflict",
  "Unlocated place",
  "Place lookup failed",
];

function overlaps(a: ProposalItem, b: ProposalItem): boolean {
  if (
    a.day === undefined ||
    a.day !== b.day ||
    !a.startTime ||
    !a.endTime ||
    !b.startTime ||
    !b.endTime
  )
    return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function deriveOpenItems(plan: TripPlan, tripPlaces: TripPlaces): OpenItem[] {
  const found: OpenItem[] = [];
  const activities =
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
  const scheduled = plan.sections.flatMap((section) => section.proposal?.items ?? []);
  for (const activity of activities) {
    const id = activity.id;
    if (!id || activity.day === undefined) continue;
    const label = activity.detail;
    if (scheduled.some((other) => other !== activity && overlaps(activity, other)))
      found.push({ kind: "Time conflict", stopId: id, label, key: `time-${id}` });
    const status = tripPlaces.locationStatus(activity);
    if (status === "unconfirmed")
      found.push({ kind: "Unlocated place", stopId: id, label, key: `location-${id}` });
    if (status === "unavailable")
      found.push({ kind: "Place lookup failed", stopId: id, label, key: `lookup-${id}` });
  }

  const conflictIds = new Set(
    found.filter((item) => item.kind === "Time conflict").map((item) => item.stopId),
  );
  for (const [id, notices] of placeConflicts(plan).stops) {
    if (conflictIds.has(id)) continue;
    if (!notices.some((notice) => /overlap/i.test(noticeText("en", notice)))) continue;
    const activity = activities.find((item) => item.id === id);
    if (!activity) continue;
    found.push({
      kind: "Time conflict",
      stopId: id,
      label: activity.detail,
      key: `conflict-${id}`,
    });
  }
  return found;
}
