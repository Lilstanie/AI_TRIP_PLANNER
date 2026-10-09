import { z } from "zod";
import { ArriveBy, TripPlan, type ProposalItem } from "@trip/shared";
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
import { mapProvider, routeLeg } from "../map-provider";
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
  legModeOf,
  routeModeOf,
  simulatedRoute,
  storedRouteMode,
} from "./leg-routes";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const EditRequest = z.object({
  plan: TripPlan,
  baseVersion: z.number().int().nonnegative(),
  // The Settings display currency, the last step of `effectiveCurrency`; absent means AUD. It only
  // chooses how the sentences an edit rewrites spell amounts; the plan stays in AUD.
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
      // Set by the workspace when it saves the map's place on a stop: the day's legs are routed
      // once after its last save (`verify`), not once per save.
      routeLater: z.boolean().optional(),
    }),
    // The traveller's mode for the leg into stop `id`, from the stop before it on the same day.
    z.object({ kind: z.literal("leg"), id: z.string(), mode: z.enum(LEG_MODES) }),
    z.object({
      kind: z.literal("choose"),
      section: z.enum(["accommodation", "transport"]),
      selectionId: z.string().min(1).max(100),
      candidateId: z.string().min(1).max(100),
    }),
    // A stop taken off the trip, set aside as an Idea, or put at the end of a day (keeping its duration).
    z.object({ kind: z.literal("remove"), id: z.string() }),
    z.object({ kind: z.literal("idea"), id: z.string() }),
    z.object({ kind: z.literal("schedule"), id: z.string(), day: z.number().int().positive() }),
    // An arrow move: the stop trades start times with the stop before it (-1) or after it (1).
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
          priceNeedsReview: z.boolean().optional(),
          arriveBy: ArriveBy.optional(),
        }),
      ),
    }),
  ]),
});
export type EditInput = z.input<typeof EditRequest>;
/**
 * One stop an edit moves, as values rather than a sentence so the interface can word it in either
 * language. `days` is present only when the stop changes day.
 */
export type EditDifference = {
  stop: string;
  days?: { from: number; to: number };
  before: string;
  after: string;
  placeChanged: boolean;
};

/**
 * What stops an edit, twice: `blockerNotices` for the interface to show in either language, and
 * `blockers`, the same notices in English, for clients older than the notices. A blocker the
 * edit leaves unresolved is kept on the plan in English. Route provider wording is a raw notice.
 */
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
/** The name a stop is known by in a notice: its place, else the first part of its description. */
const stopName = (item: ProposalItem) => item.location ?? item.detail.split(/[:;]/)[0]!.trim();
/** The operations that change a stop's day, order or existence, on the item transform of `applyItemAction`. */
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
/**
 * Take a different stay or fare from the ones the specialist already found.
 *
 * Deliberately not part of the activity path above: that path exists to re-time
 * and re-route stops, and none of it applies to swapping a priced choice. The
 * item is found by `selectionId` rather than by day, because a day can carry
 * both a flight and a ground hop.
 */
function chooseCandidate(
  plan: TripPlan,
  baseVersion: number,
  operation: { section: "accommodation" | "transport"; selectionId: string; candidateId: string },
  currency: Currency,
): EditPreview {
  // Amounts are AUD planning amounts; the sentences spell them in the trip's currency.
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
    // The transport agent prices the first hop as a return fare, so its sentence names the
    // return date; a swapped fare has to say the same thing.
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

/**
 * The providers a live edit asks: places, time zones and routes from the web map provider (Google
 * first, OSM when Google cannot answer). A route failure is an `unavailable` leg, never a throw.
 */
export const LIVE_EDIT_DEPS = {
  route: (from: string, to: string, departure: string, mode: RouteMode) =>
    routeLeg(mapProvider(), from, to, departure, mode),
  placeDetails: async (id: string) => (await mapProvider().placeDetails(id)).value,
  timeZone: async (place: GooglePlace, date: string) =>
    (await mapProvider().timeZone(place, date)).value,
};
/**
 * Simulated mode: no provider is called. Places are placeholders and every leg is a fixture, so a plan
 * with saved places routes the same way on every run. Chosen by the request's data mode, never by a
 * missing key.
 */
export const SIMULATED_EDIT_DEPS = {
  route: simulatedRoute,
  placeDetails: async (id: string) =>
    ({ id, location: { latitude: 0, longitude: 0 } }) as GooglePlace,
  timeZone: async () => "UTC",
};
export type EditDependencies = typeof LIVE_EDIT_DEPS;

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
  // Ideas (activities with no day) are set aside and kept as they are: only scheduled stops are
  // routed and re-timed.
  let ideas = section.proposal.items.filter((i) => i.kind === "activity" && i.day === undefined);
  let activities = section.proposal.items.filter(
    (i) => i.kind === "activity" && i.day !== undefined,
  );
  const before = structuredClone(activities);
  if (
    activities.some((i) => !i.id || !i.day || !i.startTime || !i.endTime) ||
    new Set(activities.map((i) => i.id)).size !== activities.length
  )
    throw new NoticeError({
      key: "Activities need unique IDs and a complete schedule before editing.",
    });
  // A remove, Idea, schedule or arrow move is the item transform of `applyItemAction`, applied here so the
  // plan it checks is the plan it would leave. Its days are then routed like any other edit's.
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
      // The leg a stop had before the edit comes back with its mode, or is removed if it had none.
      if (saved.arriveBy) restoredItem.arriveBy = saved.arriveBy;
      else delete restoredItem.arriveBy;
      return restoredItem;
    });
    activities.splice(0, activities.length, ...restored);
  } else if (isStructural(operation)) {
    // The day the stop left and the day it is on now are routed; the stop after it on either is one of their legs.
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
      // A leg is the journey from the stop before it. Moving a stop changes its own leg and the leg of
      // the stop that followed it, in both places, so those lose their stored legs; the defaults apply
      // until the day's legs are routed again.
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
      // The first stop of a day has nothing before it, so it has no leg to choose.
      if (activities.filter((a) => a.day === item.day)[0] === item)
        throw new NoticeError({ key: "This stop has no journey before it." });
    } else {
      await deps.placeDetails(operation.placeId);
      item.placeId = operation.placeId;
      item.priceNeedsReview = true;
      // Provider display text is deliberately kept outside the persisted plan.
    }
  }
  const routes: RouteResult[] = [],
    blockers: Notice[] = [];
  // The stop a route or timing blocker belongs to: the stop its leg leads into. Its notice is shown on
  // that stop only, not under every stop of the day.
  const blockedStop = new Map<Notice, string>();
  // A route failure's stop name, which a refusal shows in front of the provider's reason.
  const reasonOf = new Map<Notice, string>();
  // The place notices that only keep the stop's time open; a schedule is not refused for them.
  const unconfirmed = new Set<Notice>();
  const block = (notice: Notice, stop: string | undefined, name?: string) => {
    blockers.push(notice);
    if (stop) blockedStop.set(notice, stop);
    if (name) reasonOf.set(notice, name);
  };
  // A place saved with `routeLater` changes no time and asks for no route; its day is routed once
  // afterwards by a `verify`.
  const routed = !(operation.kind === "place" && operation.routeLater);
  // The departure a leg is routed from: the previous stop's end, in its place's local time.
  const departureFor = async (from: ProposalItem, day: number) => {
    const place = await deps.placeDetails(from.placeId!);
    const zone = await deps.timeZone(place, dateFor(day));
    return localInstant(dateFor(day), from.endTime!, zone);
  };
  for (const day of routed ? affected : []) {
    if (day < 1 || day > days)
      throw new NoticeError({ key: "Activity day is outside trip dates." });
    const daily = activities.filter((a) => a.day === day);
    const original = before.filter((a) => a.day === day);
    // A swap keeps the start times it traded: none of its stops is re-timed, and a leg that does not fit them is a
    // notice on its stop, as a time change's is.
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
      // Confirming a place is how a pair gets its route, so a place edit is not refused for an
      // unconfirmed neighbour; that pair keeps its time until both places are confirmed.
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
          // The leg into this stop. The traveller's choice is requested alone; a leg they did not
          // change keeps its stored duration; any other leg is requested with its stored mode, or
          // with the default when it has none.
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
            const route = choice
              ? await deps.route(from, to, departure, routeModeOf(choice))
              : stored
                ? await deps.route(from, to, departure, stored)
                : await defaultLegRoute(deps.route, from, to, departure);
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
            // Google answered without a route: the leg says so, and adds no time to the day.
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
  // What refuses the edit: a stop running past midnight; for a move or a swap any blocker; for a schedule any
  // blocker but an unconfirmed place. Every other blocker stays on the plan: its English sentence is kept in
  // conflictsWith, which the chat reads, and its keyed notice in editIssues, on its stop.
  const refusesAll = operation.kind === "move";
  const refuses = (blocker: Notice) =>
    outsideDay(blocker) ||
    refusesAll ||
    (operation.kind === "schedule" && !unconfirmed.has(blocker));
  const kept = blockers.filter((blocker) => !refuses(blocker));
  const unresolved = kept.map((blocker) => noticeText("en", blocker));
  // A refusal that is a route failure names its stop before the provider's reason.
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
  // A stop taken off its day (removed, or an Idea) keeps none of the notices it had there.
  if (isStructural(operation)) affectedIds.add(operation.id);
  const retainedIssues = (plan.editIssues ?? []).filter(
    (issue) =>
      issue.code !== "price_unverified" && !issue.activityIds.some((id) => affectedIds.has(id)),
  );
  // conflictsWith holds the English sentence of each issue; editIssues holds the keyed notice.
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
    // A stop that was an Idea, or was not on a day, has no earlier time to compare.
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
            // The stop's name, not its whole description: the preview lists one line per stop.
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
