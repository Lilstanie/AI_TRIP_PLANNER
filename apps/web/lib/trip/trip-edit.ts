import { z } from "zod";
import { ArriveBy, TripPlan, ProposalItem } from "@trip/shared";
import {
  Currency,
  describeFlightChoice,
  describeStayChoice,
  effectiveCurrency,
  formatMoney,
  stayChoiceCost,
} from "@trip/shared";
import {
  localInstant,
  type GooglePlace,
  type RouteMode,
  type RouteResult,
} from "../integrations/google";
import { mapProvider, mockUsesProvider, routeLeg } from "../map-provider";
import type { MapProvider, RouteHints } from "../map-provider/types";
import {
  errorNotice,
  NoticeError,
  noticeText,
  readStoredNotice,
  storeNotice,
  type Notice,
} from "../i18n/notice";
import { PRICE_CHECK_MESSAGE } from "./conflicts";
import { settlePlan } from "./settle";
import { applyItemAction, type ItemAction } from "./item-actions";
import {
  defaultLegRoute,
  LEG_MODES,
  type LegRouter,
  legModeOf,
  routeModeOf,
  simulatedRoute,
  storedRouteMode,
} from "./leg-routes";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const EditRequest = z.object({
  plan: TripPlan,
  baseVersion: z.number().int().nonnegative(),

  displayCurrency: Currency.optional(),
  operation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("verify"), day: z.number().int().positive() }),
    z.object({
      kind: z.literal("move"),
      id: z.string(),
      day: z.number().int().positive(),
      index: z.number().int().nonnegative(),
    }),
    z.object({ kind: z.literal("time"), id: z.string(), startTime: clock, endTime: clock }),
    z.object({
      kind: z.literal("place"),
      id: z.string(),
      placeId: z.string().min(1).max(300),

      routeLater: z.boolean().optional(),
    }),

    z.object({ kind: z.literal("leg"), id: z.string(), mode: z.enum(LEG_MODES) }),
    z.object({
      kind: z.literal("choose"),
      section: z.enum(["accommodation", "transport"]),
      selectionId: z.string().min(1).max(100),
      candidateId: z.string().min(1).max(100),
    }),

    z.object({ kind: z.literal("remove"), id: z.string() }),
    z.object({ kind: z.literal("idea"), id: z.string() }),
    z.object({ kind: z.literal("schedule"), id: z.string(), day: z.number().int().positive() }),

    z.object({
      kind: z.literal("swap"),
      id: z.string(),
      direction: z.union([z.literal(-1), z.literal(1)]),
    }),
    z.object({
      kind: z.literal("undo"),
      activities: z.array(
        z.object({
          id: z.string(),
          day: z.number().int().positive(),
          startTime: clock,
          endTime: clock,
          placeId: z.string().optional(),
          savedPlace: ProposalItem.shape.savedPlace,
          priceNeedsReview: z.boolean().optional(),
          arriveBy: ArriveBy.optional(),
        }),
      ),
    }),
  ]),
});
export type EditInput = z.input<typeof EditRequest>;

export type EditDifference = {
  stop: string;
  days?: { from: number; to: number };
  before: string;
  after: string;
  placeChanged: boolean;
};

export type EditPreview = {
  plan: TripPlan;
  baseVersion: number;
  routes: RouteResult[];
  differences: EditDifference[];
  blockers: string[];
  blockerNotices: Notice[];
};
const BEYOND_DAY = "Day {day}: {stop} would extend beyond the day.";
const CONFIRM_PLACE =
  "Day {day}: confirm the place for {stop} first, so its travel time can be checked.";
const NAMED_REASON = "{stop}: {reason}";
const outsideDay = (blocker: Notice) => "key" in blocker && blocker.key === BEYOND_DAY;

const stopName = (item: ProposalItem) => item.location ?? item.detail.split(/[:;]/)[0]!.trim();

type StructuralOperation = Extract<
  EditInput["operation"],
  { kind: "remove" | "idea" | "schedule" | "swap" }
>;
const isStructural = (operation: EditInput["operation"]): operation is StructuralOperation =>
  operation.kind === "remove" ||
  operation.kind === "idea" ||
  operation.kind === "schedule" ||
  operation.kind === "swap";
function actionOf(operation: StructuralOperation): ItemAction {
  switch (operation.kind) {
    case "remove":
      return { kind: "remove" };
    case "idea":
      return { kind: "idea" };
    case "schedule":
      return { kind: "day", day: operation.day };
    case "swap":
      return { kind: "move", direction: operation.direction };
  }
}
const mins = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const hhmm = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

function chooseCandidate(
  plan: TripPlan,
  baseVersion: number,
  operation: { section: "accommodation" | "transport"; selectionId: string; candidateId: string },
  currency: Currency,
): EditPreview {
  const aud = (amount: number) => formatMoney(amount, currency);
  const section = plan.sections.find((s) => s.id === operation.section);
  const proposal = section?.proposal;
  if (!proposal)
    throw new NoticeError({ key: "That part of the plan has nothing to choose from." });
  const item = proposal.items.find((i) => i.selectionId === operation.selectionId);
  if (!item) throw new NoticeError({ key: "That choice is no longer part of the plan." });

  let before: string;
  let after: string;
  let label: string;

  if (operation.section === "accommodation") {
    const stay = proposal.stays?.find((s) => s.id === operation.selectionId);
    const chosen = stay?.candidates.find((c) => c.id === operation.candidateId);
    const was = stay?.candidates.find((c) => c.id === stay.selectedId);
    if (!stay || !chosen || !was)
      throw new NoticeError({ key: "That stay option is no longer offered." });
    const cost = stayChoiceCost(chosen.pricePerNight, stay.rooms, stay.nights);
    label = stay.city;
    before = `${was.name}, ${aud(stayChoiceCost(was.pricePerNight, stay.rooms, stay.nights))}`;
    after = `${chosen.name}, ${aud(cost)}`;
    stay.selectedId = chosen.id;
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
  } else {
    const flight = proposal.flights?.find((f) => f.id === operation.selectionId);
    const chosen = flight?.candidates.find((c) => c.id === operation.candidateId);
    const was = flight?.candidates.find((c) => c.id === flight.selectedId);
    if (!flight || !chosen || !was)
      throw new NoticeError({ key: "That fare is no longer offered." });
    label = `${flight.from} → ${flight.to}`;
    before = `${was.carrier}, ${aud(was.price)}`;
    after = `${chosen.carrier}, ${aud(chosen.price)}`;
    flight.selectedId = chosen.id;
    item.estCost = chosen.price;

    const returning = flight.id === "flight-0" ? plan.brief.dates[1] : undefined;
    item.detail = describeFlightChoice({
      from: flight.from,
      to: flight.to,
      carrier: chosen.carrier,
      ...(chosen.note ? { note: chosen.note } : {}),
      ...(returning ? { returning } : {}),
    });
  }

  settlePlan(plan, baseVersion, currency);
  return {
    plan: TripPlan.parse(plan),
    baseVersion,
    routes: [],
    differences: [{ stop: label, before, after, placeChanged: false }],
    blockers: [],
    blockerNotices: [],
  };
}

export type EditDependencies = {
  route(
    from: string,
    to: string,
    departure: string,
    mode: RouteMode,
    hints?: RouteHints,
  ): Promise<RouteResult>;
  placeDetails(id: string): Promise<GooglePlace>;
  timeZone(place: GooglePlace, date: string): Promise<string>;
};

export function liveEditDeps(provider: () => MapProvider = mapProvider): EditDependencies {
  return {
    route: (from, to, departure, mode, hints) =>
      routeLeg(provider(), from, to, departure, mode, hints),
    placeDetails: async (id) => (await provider().placeDetails(id)).value,
    timeZone: async (place, date) => (await provider().timeZone(place, date)).value,
  };
}
export const LIVE_EDIT_DEPS = liveEditDeps();

export const SIMULATED_EDIT_DEPS: EditDependencies = {
  route: simulatedRoute,
  placeDetails: async (id) => ({ id, location: { latitude: 0, longitude: 0 } }) as GooglePlace,
  timeZone: async () => "UTC",
};

export async function previewEdit(
  input: unknown,
  deps: EditDependencies = LIVE_EDIT_DEPS,
): Promise<EditPreview> {
  const { plan, baseVersion, operation, displayCurrency } = EditRequest.parse(input);
  const currency = effectiveCurrency(plan.brief, displayCurrency ?? "AUD");
  if ((plan.editVersion ?? 0) !== baseVersion)
    throw new NoticeError({ key: "This edit is stale. Start from the current plan." });
  if (
    plan.tripId !== plan.brief.tripId ||
    plan.sections.some((s) => s.proposal && s.proposal.agent !== s.id)
  )
    throw new NoticeError({ key: "Plan identifiers do not match. Restore or replan first." });
  if (operation.kind === "choose") return chooseCandidate(plan, baseVersion, operation, currency);
  let section = plan.sections.find((s) => s.id === "itinerary");
  if (!section?.proposal) throw new NoticeError({ key: "There are no activities to edit." });

  let ideas = section.proposal.items.filter((i) => i.kind === "activity" && i.day === undefined);
  let activities = section.proposal.items.filter(
    (i) => i.kind === "activity" && i.day !== undefined,
  );
  const before = structuredClone(activities);

  const details = new Map<string, Promise<GooglePlace>>();
  const placeOf = (id: string) => {
    let place = details.get(id);
    if (!place)
      details.set(
        id,
        (place = deps.placeDetails(id).catch((error) => {
          const saved = activities.find((a) => a.placeId === id)?.savedPlace;
          if (!saved) throw error;
          return {
            id,
            displayName: { text: saved.name },
            formattedAddress: saved.address,
            location: saved.location,
          };
        })),
      );
    return place;
  };
  if (
    activities.some((i) => !i.id || !i.day || !i.startTime || !i.endTime) ||
    new Set(activities.map((i) => i.id)).size !== activities.length
  )
    throw new NoticeError({
      key: "Activities need unique IDs and a complete schedule before editing.",
    });

  if (isStructural(operation)) {
    const moved = applyItemAction(plan, operation.id, actionOf(operation), currency);
    plan.sections = moved.sections;
    section = plan.sections.find((s) => s.id === "itinerary");
    if (!section?.proposal) throw new NoticeError({ key: "There are no activities to edit." });
    ideas = section.proposal.items.filter((i) => i.kind === "activity" && i.day === undefined);
    activities = section.proposal.items.filter((i) => i.kind === "activity" && i.day !== undefined);
  }
  const days = (Date.parse(plan.brief.dates[1]) - Date.parse(plan.brief.dates[0])) / 86400000;
  const dateFor = (day: number) =>
    new Date(Date.parse(plan.brief.dates[0]) + (day - 1) * 86400000).toISOString().slice(0, 10);
  const segment = (day: number) => {
    if (!plan.brief.destination.includes("&")) return plan.brief.destination;
    const stays = plan.sections.flatMap((s) => s.proposal?.stays ?? []);
    return stays.find((s) => dateFor(day) >= s.checkIn && dateFor(day) < s.checkOut)?.id;
  };
  const affected = new Set<number>();
  let anchor: { day: number; index: number; time: string } | undefined;
  if (operation.kind === "verify") {
    affected.add(operation.day);
  } else if (operation.kind === "undo") {
    if (
      operation.activities.length !== activities.length ||
      new Set(operation.activities.map((a) => a.id)).size !== activities.length
    )
      throw new NoticeError({ key: "Undo activities do not match this plan." });
    const restored: ProposalItem[] = operation.activities.map((saved) => {
      const item = activities.find((a) => a.id === saved.id);
      if (!item || !segment(item.day!) || segment(saved.day) !== segment(item.day!))
        throw new NoticeError({ key: "Undo cannot change destination segments." });
      affected.add(saved.day);
      affected.add(item.day!);
      const restoredItem: ProposalItem = {
        ...item,
        ...saved,
        placeId: saved.placeId,
        priceNeedsReview: saved.priceNeedsReview,
      };
      if (saved.savedPlace) restoredItem.savedPlace = saved.savedPlace;
      else if (saved.placeId !== item.placeId) delete restoredItem.savedPlace;

      if (saved.arriveBy) restoredItem.arriveBy = saved.arriveBy;
      else delete restoredItem.arriveBy;
      return restoredItem;
    });
    activities.splice(0, activities.length, ...restored);
  } else if (isStructural(operation)) {
    for (const stop of [
      before.find((a) => a.id === operation.id),
      activities.find((a) => a.id === operation.id),
    ])
      if (stop?.day !== undefined) affected.add(stop.day);
  } else {
    const item = activities.find((a) => a.id === operation.id);
    if (!item) throw new NoticeError({ key: "Activity not found." });
    affected.add(item.day!);
    if (operation.kind === "move") {
      if (
        operation.day > days ||
        !segment(item.day!) ||
        segment(item.day!) !== segment(operation.day)
      )
        throw new NoticeError({
          key: "Move must stay within the same destination accommodation segment.",
        });
      const target = activities.filter((a) => a.day === operation.day && a.id !== item.id);
      if (operation.index > target.length)
        throw new NoticeError({ key: "Invalid activity position." });
      anchor = {
        day: operation.day,
        index: operation.index,
        time: target[operation.index]?.startTime ?? target.at(-1)?.endTime ?? "09:00",
      };

      const sameDay = activities.filter((a) => a.day === item.day);
      const oldFollower = sameDay[sameDay.indexOf(item) + 1];
      activities.splice(activities.indexOf(item), 1);
      item.day = operation.day;
      const next = target[operation.index];
      const insert = next
        ? activities.indexOf(next)
        : target.length
          ? activities.indexOf(target.at(-1)!) + 1
          : activities.length;
      activities.splice(insert, 0, item);
      delete item.arriveBy;
      if (oldFollower) delete oldFollower.arriveBy;
      if (next) delete next.arriveBy;
      affected.add(operation.day);
    } else if (operation.kind === "time") {
      if (operation.endTime <= operation.startTime)
        throw new NoticeError({ key: "End time must be after start time on the same day." });
      item.startTime = operation.startTime;
      item.endTime = operation.endTime;
    } else if (operation.kind === "leg") {
      if (activities.filter((a) => a.day === item.day)[0] === item)
        throw new NoticeError({ key: "This stop has no journey before it." });
    } else {
      const place = await placeOf(operation.placeId);
      item.placeId = operation.placeId;
      if (place.location)
        item.savedPlace = {
          name: place.displayName?.text || item.location || item.detail,
          address: place.formattedAddress,
          location: place.location,
        };
      item.priceNeedsReview = true;
    }
  }
  const routes: RouteResult[] = [],
    blockers: Notice[] = [];

  const blockedStop = new Map<Notice, string>();

  const reasonOf = new Map<Notice, string>();

  const unconfirmed = new Set<Notice>();
  const block = (notice: Notice, stop: string | undefined, name?: string) => {
    blockers.push(notice);
    if (stop) blockedStop.set(notice, stop);
    if (name) reasonOf.set(notice, name);
  };

  const routed = !(operation.kind === "place" && operation.routeLater);

  const departureFor = async (from: ProposalItem, day: number) => {
    const place = await placeOf(from.placeId!);
    const zone = await deps.timeZone(place, dateFor(day));
    return localInstant(dateFor(day), from.endTime!, zone);
  };

  const legHints = async (from: string, to: string): Promise<RouteHints> => {
    const [origin, destination] = await Promise.all([placeOf(from), placeOf(to)]);
    return { fromLocation: origin.location, toLocation: destination.location };
  };
  for (const day of routed ? affected : []) {
    if (day < 1 || day > days)
      throw new NoticeError({ key: "Activity day is outside trip dates." });
    const daily = activities.filter((a) => a.day === day);
    const original = before.filter((a) => a.day === day);

    const changedIndex =
      operation.kind === "swap"
        ? Number.POSITIVE_INFINITY
        : operation.kind === "move" || isStructural(operation)
          ? Math.min(
              ...[
                original.findIndex((a) => a.id === operation.id),
                daily.findIndex((a) => a.id === operation.id),
              ].filter((i) => i >= 0),
            )
          : operation.kind === "time" || operation.kind === "place" || operation.kind === "leg"
            ? daily.findIndex((a) => a.id === operation.id)
            : 0;
    for (let index = 0; index < daily.length; index++) {
      const current = daily[index]!;
      const duration = mins(current.endTime!) - mins(current.startTime!);
      let start =
        anchor?.day === day && anchor.index === index
          ? mins(anchor.time)
          : mins(current.startTime!);
      const previous = daily[index - 1];

      if (previous && (!previous.placeId || !current.placeId) && operation.kind !== "place") {
        const notice: Notice = {
          key: CONFIRM_PLACE,
          params: { day, stop: stopName(previous.placeId ? current : previous) },
        };
        unconfirmed.add(notice);
        block(notice, current.id);
        break;
      }
      if (previous && previous.placeId && current.placeId) {
        try {
          const choice =
            operation.kind === "leg" && operation.id === current.id ? operation.mode : undefined;
          const stored = storedRouteMode(current);
          let travel: number | undefined;
          if (operation.kind === "leg" && !choice && stored && current.arriveBy) {
            travel = current.arriveBy.durationMin;
          } else {
            const from = previous.placeId;
            const to = current.placeId;
            const departure = await departureFor(previous, day);
            const legRouter: LegRouter = async (a, b, when, mode) =>
              deps.route(a, b, when, mode, await legHints(a, b));
            const route = choice
              ? await legRouter(from, to, departure, routeModeOf(choice))
              : stored
                ? await legRouter(from, to, departure, stored)
                : await defaultLegRoute(legRouter, from, to, departure);
            routes.push(route);
            if (
              route.status === "unavailable" ||
              (route.status === "ok" &&
                (route.durationMin === undefined ||
                  !Number.isFinite(route.durationMin) ||
                  route.durationMin <= 0))
            ) {
              block(
                route.notice ?? (route.error ? { raw: route.error } : { key: "Route unavailable" }),
                current.id,
                stopName(current),
              );
              break;
            }

            if (route.status === "ok") {
              travel = route.durationMin;
              current.arriveBy = {
                mode: legModeOf(route.mode),
                durationMin: route.durationMin!,
                from: previous.location ?? previous.detail,
              };
            } else delete current.arriveBy;
          }
          if (travel !== undefined) {
            const earliest = mins(previous.endTime!) + travel + 15;
            const keepExact =
              operation.kind === "undo" ||
              operation.kind === "verify" ||
              index < changedIndex ||
              (operation.kind === "time" && index === changedIndex);
            if (keepExact) {
              if (start < earliest)
                block(
                  {
                    key: "Day {day}: {stop} needs at least {minutes} minutes after the previous activity.",
                    params: { day, stop: current.detail, minutes: travel + 15 },
                  },
                  current.id,
                );
            } else start = Math.max(start, earliest);
          }
        } catch (error) {
          block(
            errorNotice(error, { key: "Route verification failed" }),
            current.id,
            stopName(current),
          );
          break;
        }
      }
      if (start + duration >= 1440) {
        blockers.push({ key: BEYOND_DAY, params: { day, stop: stopName(current) } });
        break;
      }
      current.startTime = hhmm(start);
      current.endTime = hhmm(start + duration);
    }
  }

  const refusesAll = operation.kind === "move";
  const refuses = (blocker: Notice) =>
    outsideDay(blocker) ||
    refusesAll ||
    (operation.kind === "schedule" && !unconfirmed.has(blocker));
  const kept = blockers.filter((blocker) => !refuses(blocker));
  const unresolved = kept.map((blocker) => noticeText("en", blocker));

  blockers.splice(
    0,
    blockers.length,
    ...blockers.filter(refuses).map((blocker): Notice =>
      reasonOf.has(blocker)
        ? {
            key: NAMED_REASON,
            params: { stop: reasonOf.get(blocker)!, reason: blocker },
          }
        : blocker,
    ),
  );
  section.proposal.items = [
    ...section.proposal.items.filter((i) => i.kind !== "activity"),
    ...activities,
    ...ideas,
  ];
  const affectedIds = new Set(activities.filter((a) => affected.has(a.day!)).map((a) => a.id!));

  if (isStructural(operation)) affectedIds.add(operation.id);
  const retainedIssues = (plan.editIssues ?? []).filter(
    (issue) =>
      issue.code !== "price_unverified" && !issue.activityIds.some((id) => affectedIds.has(id)),
  );

  const sentenceOf = (message: string) => noticeText("en", readStoredNotice(message));
  const oldIssueSentences = new Set(
    (plan.editIssues ?? []).map((issue) => sentenceOf(issue.message)),
  );
  const retainedLegacy = section.proposal.conflictsWith.filter((message) => {
    if (oldIssueSentences.has(message) || message === PRICE_CHECK_MESSAGE) return false;
    const namedDay = /day (\d+)/i.exec(message);
    return namedDay ? !affected.has(Number(namedDay[1])) : activities.some((a) => !a.placeId);
  });
  section.proposal.conflictsWith = [
    ...new Set([...retainedLegacy, ...retainedIssues.map((issue) => sentenceOf(issue.message))]),
    ...unresolved,
    ...(activities.some((a) => a.priceNeedsReview) ? [PRICE_CHECK_MESSAGE] : []),
  ];
  plan.editIssues = [
    ...retainedIssues,
    ...kept.map((blocker) => ({
      code: "route_unavailable" as const,
      message: storeNotice(blocker),
      activityIds: blockedStop.has(blocker) ? [blockedStop.get(blocker)!] : [],
    })),
    ...activities
      .filter((a) => a.priceNeedsReview)
      .map((a) => ({
        code: "price_unverified" as const,
        message: PRICE_CHECK_MESSAGE,
        activityIds: [a.id!],
      })),
  ];
  settlePlan(plan, baseVersion, currency);
  const differences = activities.flatMap((a): EditDifference[] => {
    const old = before.find((b) => b.id === a.id);

    if (!old)
      return [
        {
          stop: a.location ?? a.detail,
          before: "—",
          after: `${a.startTime}–${a.endTime}`,
          placeChanged: false,
        },
      ];
    return old.day !== a.day ||
      old.startTime !== a.startTime ||
      old.endTime !== a.endTime ||
      old.placeId !== a.placeId
      ? [
          {
            stop: a.location ?? a.detail,
            ...(old.day === a.day ? {} : { days: { from: old.day!, to: a.day! } }),
            before: `${old.startTime}–${old.endTime}`,
            after: `${a.startTime}–${a.endTime}`,
            placeChanged: old.placeId !== a.placeId,
          },
        ]
      : [];
  });
  return {
    plan: TripPlan.parse(plan),
    baseVersion,
    routes,
    differences,
    blockers: blockers.map((blocker) => noticeText("en", blocker)),
    blockerNotices: blockers,
  };
}
