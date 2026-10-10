import { effectiveCurrency, TripPlan, type Currency, type ProposalItem } from "@trip/shared";
import { visitingOrder } from "./itinerary";
import { dayCount } from "./timeline";
import { settlePlan } from "./settle";
import { NoticeError } from "../i18n/notice";

export type ItemAction =
  | { kind: "details"; detail: string; location: string }
  | { kind: "note"; note: string }
  | { kind: "booked"; booked: boolean }
  | { kind: "remove" }
  | { kind: "idea" }
  | { kind: "day"; day: number }
  | { kind: "move"; direction: -1 | 1 };

const DEFAULT_MINUTES = 120;
const DAY_START = 9 * 60;
const DAY_END = 23 * 60 + 59;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

function followerOf(items: ProposalItem[], stop: ProposalItem): ProposalItem | undefined {
  const day = items.filter((other) => other.kind === "activity" && other.day === stop.day);
  return day[day.indexOf(stop) + 1];
}

export function applyItemAction(
  plan: TripPlan,
  id: string,
  action: ItemAction,
  displayCurrency?: Currency,
): TripPlan {
  const next = structuredClone(plan);
  const section = next.sections.find((item) => item.id === "itinerary");
  const items = section?.proposal?.items;
  if (!items) throw new NoticeError({ key: "That stop is no longer in this trip." });
  let index = items.findIndex((item) => item.kind === "activity" && item.id === id);

  if (index < 0) {
    const pick = next.sections
      .find((item) => item.id === "dining")
      ?.proposal?.items.find((item) => item.kind === "meal" && item.id === id);
    if (!pick) throw new NoticeError({ key: "That stop is no longer in this trip." });
    items.push({ ...structuredClone(pick), kind: "activity" });
    index = items.length - 1;
  }
  const item = items[index]!;

  switch (action.kind) {
    case "details": {
      const detail = action.detail.trim();
      if (!detail) throw new NoticeError({ key: "Give the stop a description." });
      item.detail = detail.slice(0, 500);
      const location = action.location.trim();
      if (location) item.location = location.slice(0, 120);
      else delete item.location;
      break;
    }
    case "note": {
      const note = action.note.trim().slice(0, 500);
      if (note) item.note = note;
      else delete item.note;
      break;
    }
    case "booked":
      if (action.booked) item.booked = true;
      else delete item.booked;
      break;
    case "remove": {
      const follower = followerOf(items, item);
      if (follower) delete follower.arriveBy;
      items.splice(index, 1);

      const dining = next.sections.find((section) => section.id === "dining")?.proposal?.items;
      const pick = dining?.findIndex((other) => other.kind === "meal" && other.id === id) ?? -1;
      if (dining && pick >= 0) dining.splice(pick, 1);
      break;
    }
    case "idea":
      const follower = followerOf(items, item);
      if (follower) delete follower.arriveBy;
      delete item.day;
      delete item.startTime;
      delete item.endTime;
      delete item.arriveBy;
      break;
    case "day": {
      if (!Number.isInteger(action.day) || action.day < 1 || action.day > dayCount(plan))
        throw new NoticeError({ key: "That day is not part of this trip." });
      const duration =
        item.startTime && item.endTime
          ? minutes(item.endTime) - minutes(item.startTime)
          : DEFAULT_MINUTES;
      const others = items.filter(
        (other): other is ProposalItem & { endTime: string } =>
          other !== item &&
          other.kind === "activity" &&
          other.day === action.day &&
          !!other.endTime,
      );
      const start = others.length
        ? Math.max(...others.map((other) => minutes(other.endTime)))
        : DAY_START;
      if (start + duration > DAY_END)
        throw new NoticeError({
          key: "Day {day} has no room left for this stop; shorten another stop first.",
          params: { day: action.day },
        });

      const oldFollower = followerOf(items, item);
      if (oldFollower) delete oldFollower.arriveBy;
      item.day = action.day;
      item.startTime = clock(start);
      item.endTime = clock(start + duration);
      delete item.arriveBy;

      items.splice(index, 1);
      const after = items.findIndex(
        (other) =>
          other.kind === "activity" &&
          other.day === action.day &&
          !!other.startTime &&
          minutes(other.startTime) > start,
      );
      items.splice(after < 0 ? items.length : after, 0, item);
      const newFollower = followerOf(items, item);
      if (newFollower) delete newFollower.arriveBy;
      break;
    }
    case "move": {
      if (item.day === undefined || !item.startTime)
        throw new NoticeError({ key: "Only a stop scheduled on a day can move earlier or later." });

      const day = visitingOrder(
        items.filter(
          (other) => other.kind === "activity" && other.day === item.day && !!other.startTime,
        ),
      );
      const neighbour = day[day.indexOf(item) + action.direction];
      if (!neighbour)
        throw new NoticeError({
          key:
            action.direction < 0
              ? "This is already the first stop of its day."
              : "This is already the last stop of its day.",
        });
      const [first, second] = action.direction < 0 ? [item, neighbour] : [neighbour, item];
      const [earlier, later] = action.direction < 0 ? [neighbour, item] : [item, neighbour];
      const length = (stop: ProposalItem) =>
        stop.startTime && stop.endTime
          ? minutes(stop.endTime) - minutes(stop.startTime)
          : DEFAULT_MINUTES;
      const firstStart = minutes(earlier.startTime!);
      const firstEnd = firstStart + length(first);
      const secondStart = Math.max(firstEnd, minutes(later.startTime!));
      const secondEnd = secondStart + length(second);
      if (firstEnd > DAY_END || secondEnd > DAY_END)
        throw new NoticeError({
          key: "Swapping these stops would run past 23:59; shorten one of them first.",
        });
      const following = day[day.indexOf(later) + 1];
      if (following?.startTime && secondEnd > minutes(following.startTime))
        throw new NoticeError({
          key: "Swapping these stops would overlap the next stop; shorten one of them first.",
        });
      first.startTime = clock(firstStart);
      first.endTime = clock(firstEnd);
      second.startTime = clock(secondStart);
      second.endTime = clock(secondEnd);
      delete first.arriveBy;
      delete second.arriveBy;

      if (following) delete following.arriveBy;

      const a = items.indexOf(first);
      const b = items.indexOf(second);
      if (a > b) [items[a], items[b]] = [items[b]!, items[a]!];
      break;
    }
  }
  settlePlan(next, plan.editVersion ?? 0, effectiveCurrency(plan.brief, displayCurrency ?? "AUD"));
  return TripPlan.parse(next);
}
