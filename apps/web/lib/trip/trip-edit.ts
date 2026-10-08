import { z } from "zod";
import { ArriveBy, TripPlan, type ProposalItem } from "@trip/shared";
import { detectConflicts, rollUpCost } from "@trip/orchestrator";
import {
  Currency,
  describeFlightChoice,
  describeStayChoice,
  effectiveCurrency,
  formatMoney,
  stayChoiceCost,
} from "@trip/shared";
import {
  googleRoute,
  placeDetails,
  timeZone,
  localInstant,
  type GooglePlace,
  type RouteResult,
} from "../integrations/google";
import { errorNotice, NoticeError, noticeText, type Notice } from "../i18n/notice";
import { PRICE_CHECK_MESSAGE } from "./conflicts";
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
const BEYOND_DAY = "Day {day}: activity would extend beyond the day.";
const outsideDay = (blocker: Notice) => "key" in blocker && blocker.key === BEYOND_DAY;
const mins = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const hhmm = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
/**
 * Recompute everything an edit can move: conflicts, section status, costs and
 * the version. Every operation ends here, so a new one cannot quietly skip the
 * budget roll-up or leave a stale conflict behind.
 */
function settle(plan: TripPlan, baseVersion: number, currency: Currency): void {
  plan.conflicts = detectConflicts(
    plan.sections.flatMap((s) => (s.proposal ? [s.proposal] : [])),
    plan.brief,
    currency,
  );
  // A section is unresolved when the recomputed conflicts still target it — the
  // same rule the orchestrator uses. An edit no longer rebuilds a decision list.
  plan.sections.forEach((section) => {
    section.status = plan.conflicts?.some((c) => c.targetAgent === section.id)
      ? "needs_you"
      : "draft";
  });
  // Recompute from item evidence, never trust client totals.
  plan.sections.forEach((s) => {
    if (s.proposal) s.estCost = s.proposal.items.reduce((sum, i) => sum + (i.estCost ?? 0), 0);
  });
  plan.budgetTotal = plan.brief.budgetTotal;
  // Share the orchestrator's calculator rather than keeping a float copy of it here. The two
  // already disagreed by float dust, and converted budgets make fractional cents routine.
  Object.assign(plan, rollUpCost(plan.sections, plan.budgetTotal));
  plan.editVersion = baseVersion + 1;
}

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

  settle(plan, baseVersion, currency);
  return {
    plan: TripPlan.parse(plan),
    baseVersion,
    routes: [],
    differences: [{ stop: label, before, after, placeChanged: false }],
    blockers: [],
    blockerNotices: [],
  };
}

/** The providers a live edit asks: Google's Places, Time Zone and Routes. */
export const LIVE_EDIT_DEPS = { googleRoute, placeDetails, timeZone };
/**
 * Simulated mode: no provider is called. Places are placeholders and every leg is a fixture, so a plan
 * with saved places routes the same way on every run. Chosen by the request's data mode, never by a
 * missing key.
 */
export const SIMULATED_EDIT_DEPS = {
  googleRoute: simulatedRoute,
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
  const section = plan.sections.find((s) => s.id === "itinerary");
  if (!section?.proposal) throw new NoticeError({ key: "There are no activities to edit." });
  // Ideas (activities with no day) are set aside and kept as they are: only scheduled stops are
  // routed and re-timed.
  const ideas = section.proposal.items.filter((i) => i.kind === "activity" && i.day === undefined);
  const activities = section.proposal.items.filter(
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
    const changedIndex =
      operation.kind === "move"
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
        blockers.push({
          key: "Day {day}: confirm the place for every stop first, so travel times between them can be checked.",
          params: { day },
        });
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
              ? await deps.googleRoute(from, to, departure, routeModeOf(choice))
              : stored
                ? await deps.googleRoute(from, to, departure, stored)
                : await defaultLegRoute(deps.googleRoute, from, to, departure);
            routes.push(route);
            if (
              route.status === "unavailable" ||
              (route.status === "ok" &&
                (route.durationMin === undefined ||
                  !Number.isFinite(route.durationMin) ||
                  route.durationMin <= 0))
            ) {
              blockers.push(
                route.notice ?? (route.error ? { raw: route.error } : { key: "Route unavailable" }),
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
                blockers.push({
                  key: "Day {day}: {stop} needs at least {minutes} minutes after the previous activity.",
                  params: { day, stop: current.detail, minutes: travel + 15 },
                });
            } else start = Math.max(start, earliest);
          }
        } catch (error) {
          blockers.push(errorNotice(error, { key: "Route verification failed" }));
          break;
        }
      }
      if (start + duration >= 1440) {
        blockers.push({ key: BEYOND_DAY, params: { day } });
        break;
      }
      current.startTime = hhmm(start);
      current.endTime = hhmm(start + duration);
    }
  }
  // Outside a move, only running past midnight blocks; the rest stays on the plan, in English.
  const unresolved =
    operation.kind !== "move"
      ? blockers
          .filter((blocker) => !outsideDay(blocker))
          .map((blocker) => noticeText("en", blocker))
      : [];
  if (operation.kind !== "move")
    blockers.splice(0, blockers.length, ...blockers.filter(outsideDay));
  section.proposal.items = [
    ...section.proposal.items.filter((i) => i.kind !== "activity"),
    ...activities,
    ...ideas,
  ];
  const affectedIds = new Set(activities.filter((a) => affected.has(a.day!)).map((a) => a.id!));
  const retainedIssues = (plan.editIssues ?? []).filter(
    (issue) =>
      issue.code !== "price_unverified" && !issue.activityIds.some((id) => affectedIds.has(id)),
  );
  const oldIssueMessages = new Set((plan.editIssues ?? []).map((issue) => issue.message));
  const retainedLegacy = section.proposal.conflictsWith.filter((message) => {
    if (oldIssueMessages.has(message) || message === PRICE_CHECK_MESSAGE) return false;
    const namedDay = /day (\d+)/i.exec(message);
    return namedDay ? !affected.has(Number(namedDay[1])) : activities.some((a) => !a.placeId);
  });
  section.proposal.conflictsWith = [
    ...new Set([...retainedLegacy, ...retainedIssues.map((issue) => issue.message)]),
    ...unresolved,
    ...(activities.some((a) => a.priceNeedsReview) ? [PRICE_CHECK_MESSAGE] : []),
  ];
  plan.editIssues = [
    ...retainedIssues,
    ...unresolved.map((message) => ({
      code: "route_unavailable" as const,
      message,
      activityIds: activities.filter((a) => affected.has(a.day!)).map((a) => a.id!),
    })),
    ...activities
      .filter((a) => a.priceNeedsReview)
      .map((a) => ({
        code: "price_unverified" as const,
        message: PRICE_CHECK_MESSAGE,
        activityIds: [a.id!],
      })),
  ];
  settle(plan, baseVersion, currency);
  const differences = activities.flatMap((a): EditDifference[] => {
    const old = before.find((b) => b.id === a.id)!;
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
