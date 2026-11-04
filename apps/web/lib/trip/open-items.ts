import type { ProposalItem, TripPlan } from "@trip/shared";
import type { TripPlaces } from "@/components/map/useTripPlaces";
import { placeConflicts, unplacedIssues } from "./conflicts";
import { noticeText, type Notice } from "@/lib/i18n/notice";

export type OpenItemKind =
  "Time conflict" | "Unlocated place" | "Place lookup failed" | "Unpriced stay" | "Itinerary issue";

export type OpenItem =
  | {
      kind: Exclude<OpenItemKind, "Itinerary issue" | "Unpriced stay">;
      stopId: string;
      label: string;
      key: string;
    }
  | { kind: "Unpriced stay"; day: number | undefined; label: string; key: string }
  | { kind: "Itinerary issue"; notice: Notice; key: string };

export const OPEN_ITEM_KINDS: readonly OpenItemKind[] = [
  "Time conflict",
  "Unlocated place",
  "Place lookup failed",
  "Unpriced stay",
  "Itinerary issue",
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
    found.flatMap((item) => (item.kind === "Time conflict" ? [item.stopId] : [])),
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
  const accommodation = plan.sections.find((section) => section.id === "accommodation")?.proposal;
  const selectedStays = new Set((accommodation?.stays ?? []).map((stay) => stay.id));
  (accommodation?.items ?? []).forEach((item, index) => {
    if (item.kind !== "hotel" || item.booked || item.estCost !== undefined) return;
    if (item.selectionId && selectedStays.has(item.selectionId)) return;
    found.push({
      kind: "Unpriced stay",
      day: item.day,
      label: item.detail.split(" — ")[0]!.trim(),
      key: `stay-${item.id ?? index}`,
    });
  });
  unplacedIssues(plan).forEach((notice, index) =>
    found.push({ kind: "Itinerary issue", notice, key: `issue-${index}` }),
  );
  return found;
}
