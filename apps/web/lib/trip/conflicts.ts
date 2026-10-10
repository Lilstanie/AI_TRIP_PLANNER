import type { ProposalItem, TripPlan } from "@trip/shared";
import {
  keyOfAuthoredSentence,
  noticeText,
  readStoredNotice,
  type Notice,
  type NoticeValue,
} from "../i18n/notice";

export const PRICE_CHECK_MESSAGE = "Changed activity price requires verification";

export type ConflictPlacement = {
  budget: Notice[];

  days: Map<number, Notice[]>;

  stops: Map<string, Notice[]>;
};

const INFEASIBLE = "infeasible budget";
const OVER_BUDGET = /over budget$/;
const OVERLAP = /^time overlap on day (\d+):/;
const DAY = /\bday (\d+)\b/i;

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const overlaps = (a: ProposalItem, b: ProposalItem) =>
  a.day === b.day &&
  minutes(a.startTime!) < minutes(b.endTime!) &&
  minutes(b.startTime!) < minutes(a.endTime!);

function addOnce(list: Notice[], notice: Notice) {
  if (!list.some((item) => JSON.stringify(item) === JSON.stringify(notice))) list.push(notice);
}
function addTo<K>(map: Map<K, Notice[]>, key: K, notice: Notice) {
  const list = map.get(key) ?? [];
  addOnce(list, notice);
  map.set(key, list);
}

export function placeConflicts(plan: TripPlan): ConflictPlacement {
  const placement: ConflictPlacement = { budget: [], days: new Map(), stops: new Map() };
  const itinerary =
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
  const stops = itinerary.filter(
    (item) => item.kind === "activity" && item.day !== undefined && item.id,
  );
  const scheduled = plan.sections
    .flatMap((section) => section.proposal?.items ?? [])
    .filter((item) => item.day !== undefined && item.startTime && item.endTime);

  const issues = (plan.editIssues ?? []).filter((issue) => issue.code !== "price_unverified");
  const issueSentences = new Set(
    issues.map((issue) => noticeText("en", readStoredNotice(issue.message))),
  );

  const placeAuthored = (notice: Notice) => {
    const params = ("params" in notice ? notice.params : undefined) as
      Record<string, NoticeValue> | undefined;
    const day = params?.day === undefined ? undefined : Number(params.day);
    if (day !== undefined && params?.stop !== undefined) {
      const stop = stops.find((item) => item.day === day && item.detail === params.stop);
      if (stop) return addTo(placement.stops, stop.id!, notice);
    }
    if (day !== undefined) addTo(placement.days, day, notice);
    else addOnce(placement.budget, notice);
  };

  const overlapDays = new Set<number>();
  for (const conflict of plan.conflicts ?? []) {
    for (const reason of conflict.reason.split("; ").map((part) => part.trim())) {
      if (reason === PRICE_CHECK_MESSAGE || issueSentences.has(reason)) continue;
      const authored = keyOfAuthoredSentence(reason);
      if (authored) {
        placeAuthored(authored);
        continue;
      }
      const overlap = OVERLAP.exec(reason);
      const day = DAY.exec(reason);
      if (reason.startsWith(INFEASIBLE))
        addOnce(placement.budget, {
          key: "The cheapest options found cost more than the budget. Raise the budget or change the dates in the chat.",
        });
      else if (OVER_BUDGET.test(reason))
        addOnce(placement.budget, {
          key: "The estimate is over the budget. Ask in the chat to cut part of the plan.",
        });
      else if (overlap) overlapDays.add(Number(overlap[1]));
      else if (day) addTo(placement.days, Number(day[1]), { raw: reason });
      else addOnce(placement.budget, { raw: reason });
    }
  }

  for (const day of overlapDays) {
    let marked = false;
    for (const stop of stops.filter((item) => item.day === day)) {
      const other = scheduled.find((item) => item !== stop && overlaps(stop, item));
      if (!other) continue;
      marked = true;
      addTo(placement.stops, stop.id!, {
        key: "Overlaps {range} on this day.",
        params: { range: `${other.startTime}–${other.endTime}` },
      });
    }
    if (!marked)
      addTo(placement.days, day, {
        key: "Two scheduled items overlap on Day {day}.",
        params: { day },
      });
  }

  for (const issue of issues)
    for (const id of issue.activityIds)
      if (stops.some((stop) => stop.id === id))
        addTo(placement.stops, id, readStoredNotice(issue.message));
  return placement;
}
