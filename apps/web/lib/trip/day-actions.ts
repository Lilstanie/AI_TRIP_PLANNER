import {
  describeStayChoice,
  effectiveCurrency,
  stayChoiceCost,
  TripPlan,
  type Currency,
  type ProposalItem,
} from "@trip/shared";
import { NoticeError } from "../i18n/notice";
import { settlePlan } from "./settle";
import { dayCount } from "./timeline";

export type DayAction =
  | { kind: "insert"; at: number }
  | { kind: "clear"; day: number }
  | { kind: "remove"; day: number }
  | { kind: "ideas" }
  | { kind: "removeAll" };

const DAY_MS = 86_400_000;
const shift = (date: string, by: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
const between = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const isScheduled = (item: ProposalItem) => item.kind === "activity" && item.day !== undefined;

export function scheduledOn(plan: TripPlan, day: number): number {
  return (
    plan.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items.filter((item) => isScheduled(item) && item.day === day).length ?? 0
  );
}

export function scheduledCount(plan: TripPlan): number {
  return (
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items.filter(isScheduled)
      .length ?? 0
  );
}

export function applyDayAction(
  plan: TripPlan,
  action: DayAction,
  displayCurrency?: Currency,
): TripPlan {
  const next = structuredClone(plan);
  const days = dayCount(plan);
  const currency = effectiveCurrency(plan.brief, displayCurrency ?? "AUD");
  const itinerary = next.sections.find((section) => section.id === "itinerary")?.proposal;

  switch (action.kind) {
    case "clear": {
      if (!itinerary || !scheduledOn(plan, action.day))
        throw new NoticeError({
          key: "Nothing is scheduled on Day {day}.",
          params: { day: action.day },
        });
      itinerary.items = itinerary.items.filter(
        (item) => !(isScheduled(item) && item.day === action.day),
      );
      break;
    }
    case "ideas": {
      if (!itinerary || !scheduledCount(plan))
        throw new NoticeError({ key: "Nothing is scheduled yet." });
      for (const item of itinerary.items) {
        if (!isScheduled(item)) continue;
        delete item.day;
        delete item.startTime;
        delete item.endTime;
        delete item.arriveBy;
      }
      break;
    }
    case "removeAll": {
      if (!itinerary || !scheduledCount(plan))
        throw new NoticeError({ key: "Nothing is scheduled yet." });
      itinerary.items = itinerary.items.filter((item) => !isScheduled(item));
      break;
    }
    case "insert":
      insertDay(next, action.at, days, currency);
      break;
    case "remove":
      removeDay(next, action.day, days, currency);
      break;
  }

  settlePlan(next, plan.editVersion ?? 0, currency);
  const parsed = TripPlan.safeParse(next);
  if (!parsed.success)
    throw new NoticeError({ key: "That change would leave the trip dates or stays invalid." });
  return parsed.data;
}

type Selections = {
  stays: NonNullable<NonNullable<TripPlan["sections"][number]["proposal"]>["stays"]>;
  flights: NonNullable<NonNullable<TripPlan["sections"][number]["proposal"]>["flights"]>;
};

function selectionsOf(plan: TripPlan): Selections {
  return {
    stays: plan.sections.flatMap((section) => section.proposal?.stays ?? []),
    flights: plan.sections.flatMap((section) => section.proposal?.flights ?? []),
  };
}

function resizeStay(
  plan: TripPlan,
  stay: Selections["stays"][number],
  checkOut: string,
  currency: Currency,
) {
  stay.checkOut = checkOut;
  stay.nights = between(stay.checkIn, checkOut);
  if (stay.nights < 1) throw new NoticeError({ key: "That day holds the last night of a stay." });
  const chosen = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
  const item = plan.sections
    .flatMap((section) => section.proposal?.items ?? [])
    .find((entry) => entry.selectionId === stay.id);
  if (!chosen || !item) return;
  const cost = stayChoiceCost(chosen.pricePerNight, stay.rooms, stay.nights);
  item.estCost = cost;
  item.detail = describeStayChoice({
    ...chosen,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rooms: stay.rooms,
    nights: stay.nights,
    cost,
    currency,
  });
}

function realign(plan: TripPlan, oldEnd: string) {
  const { stays, flights } = selectionsOf(plan);
  const start = plan.brief.dates[0];
  const end = plan.brief.dates[1];
  for (const stay of stays) stay.day = between(start, stay.checkIn) + 1;
  for (const flight of flights) flight.day = between(start, flight.depart) + 1;
  const dayOf = new Map<string, number>([
    ...stays.map((stay) => [stay.id, stay.day] as const),
    ...flights.map((flight) => [flight.id, flight.day] as const),
  ]);
  for (const section of plan.sections)
    for (const item of section.proposal?.items ?? []) {
      if (item.selectionId && dayOf.has(item.selectionId)) item.day = dayOf.get(item.selectionId)!;
      if (oldEnd !== end && item.selectionId && item.detail.includes(`returning ${oldEnd}`))
        item.detail = item.detail.replace(`returning ${oldEnd}`, `returning ${end}`);
    }
}

function insertDay(plan: TripPlan, at: number, days: number, currency: Currency) {
  if (!Number.isInteger(at) || at < 1 || at > days + 1)
    throw new NoticeError({ key: "That day is not part of this trip." });
  const [start, end] = plan.brief.dates;
  const date = shift(start, at - 1);
  const { stays, flights } = selectionsOf(plan);
  if (at === 1) plan.brief.dates = [shift(start, -1), end];
  else {
    plan.brief.dates = [start, shift(end, 1)];
    for (const stay of stays) {
      const appending = at === days + 1;
      if (!appending && stay.checkIn >= date) {
        stay.checkIn = shift(stay.checkIn, 1);
        stay.checkOut = shift(stay.checkOut, 1);
      } else if (appending ? stay.checkOut === end : stay.checkIn < date && stay.checkOut >= date)
        resizeStay(plan, stay, shift(stay.checkOut, 1), currency);
    }
    if (at <= days)
      for (const flight of flights)
        if (flight.depart >= date) flight.depart = shift(flight.depart, 1);
  }
  for (const section of plan.sections)
    for (const item of section.proposal?.items ?? [])
      if (item.day !== undefined && item.day >= at) item.day += 1;
  realign(plan, end);
}

function removeDay(plan: TripPlan, day: number, days: number, currency: Currency) {
  if (days < 2) throw new NoticeError({ key: "A trip needs at least one day." });
  if (!Number.isInteger(day) || day < 1 || day > days)
    throw new NoticeError({ key: "That day is not part of this trip." });
  const [start, end] = plan.brief.dates;
  const date = shift(start, day - 1);
  const { stays, flights } = selectionsOf(plan);
  if (flights.some((flight) => flight.depart === date))
    throw new NoticeError({
      key: "Day {day} has a flight, so it cannot be removed.",
      params: { day },
    });
  plan.brief.dates = [start, shift(end, -1)];
  for (const stay of stays) {
    if (stay.checkIn > date) {
      stay.checkIn = shift(stay.checkIn, -1);
      stay.checkOut = shift(stay.checkOut, -1);
    } else if (stay.checkOut > date || (day === days && stay.checkOut === date))
      resizeStay(plan, stay, shift(stay.checkOut, -1), currency);
  }
  for (const flight of flights) if (flight.depart > date) flight.depart = shift(flight.depart, -1);
  for (const section of plan.sections) {
    const proposal = section.proposal;
    if (!proposal) continue;
    proposal.items = proposal.items.filter((item) => item.selectionId || item.day !== day);
    for (const item of proposal.items) if (item.day !== undefined && item.day > day) item.day -= 1;
  }
  realign(plan, end);
}
