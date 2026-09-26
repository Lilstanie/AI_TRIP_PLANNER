import { TripPlan, type ProposalItem } from "@trip/shared";
import { dayCount } from "./timeline";

/**
 * Edits a traveller makes to one itinerary item from its action menu. Each is a pure transform of
 * the plan: details, a note, booked, remove, set aside as an idea, or put on a day. None changes
 * a route or a price the server checks, so they apply at once; schedule changes that need route
 * checks go through the Timeline's preview instead.
 */
export type ItemAction =
  | { kind: "details"; detail: string; location: string }
  | { kind: "note"; note: string }
  | { kind: "booked"; booked: boolean }
  | { kind: "remove" }
  | { kind: "idea" }
  | { kind: "day"; day: number };

const DEFAULT_MINUTES = 120;
const DAY_START = 9 * 60;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function applyItemAction(plan: TripPlan, id: string, action: ItemAction): TripPlan {
  const next = structuredClone(plan);
  const section = next.sections.find((item) => item.id === "itinerary");
  const items = section?.proposal?.items;
  const index = items?.findIndex((item) => item.kind === "activity" && item.id === id) ?? -1;
  if (!items || index < 0) throw new Error("That stop is no longer in this trip.");
  const item = items[index]!;

  switch (action.kind) {
    case "details": {
      const detail = action.detail.trim();
      if (!detail) throw new Error("Give the stop a description.");
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
    case "remove":
      items.splice(index, 1);
      break;
    case "idea":
      // An idea has no day or times; its connection belonged to the day it left.
      delete item.day;
      delete item.startTime;
      delete item.endTime;
      delete item.arriveBy;
      break;
    case "day": {
      if (!Number.isInteger(action.day) || action.day < 1 || action.day > dayCount(plan))
        throw new Error("That day is not part of this trip.");
      const duration =
        item.startTime && item.endTime
          ? minutes(item.endTime) - minutes(item.startTime)
          : DEFAULT_MINUTES;
      const others = items.filter(
        (other): other is ProposalItem & { endTime: string } =>
          other !== item && other.kind === "activity" && other.day === action.day && !!other.endTime,
      );
      const start = others.length ? Math.max(...others.map((other) => minutes(other.endTime))) : DAY_START;
      if (start + duration > 23 * 60 + 59)
        throw new Error(`Day ${action.day} has no room left for this stop; shorten another stop first.`);
      item.day = action.day;
      item.startTime = clock(start);
      item.endTime = clock(start + duration);
      delete item.arriveBy;
      // Keep the day's stops in time order in the plan, which is the order the Timeline edits by.
      items.splice(index, 1);
      const after = items.findIndex(
        (other) =>
          other.kind === "activity" &&
          other.day === action.day &&
          !!other.startTime &&
          minutes(other.startTime) > start,
      );
      items.splice(after < 0 ? items.length : after, 0, item);
      break;
    }
  }
  next.editVersion = (plan.editVersion ?? 0) + 1;
  return TripPlan.parse(next);
}
