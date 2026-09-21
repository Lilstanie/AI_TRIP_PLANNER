import { z } from "zod";
import { TripPlan, type ProposalItem } from "@trip/shared";
import { detectConflicts, rollUpCost } from "@trip/orchestrator";
import {
  googleRoute,
  placeDetails,
  timeZone,
  localInstant,
  type RouteResult,
} from "../integrations/google";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const EditRequest = z.object({
  plan: TripPlan,
  baseVersion: z.number().int().nonnegative(),
  mode: z.enum(["WALK", "TRANSIT"]).default("WALK"),
  operation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("verify"), day: z.number().int().positive() }),
    z.object({
      kind: z.literal("move"),
      id: z.string(),
      day: z.number().int().positive(),
      index: z.number().int().nonnegative(),
    }),
    z.object({ kind: z.literal("time"), id: z.string(), startTime: clock, endTime: clock }),
    z.object({ kind: z.literal("place"), id: z.string(), placeId: z.string().min(1).max(300) }),
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
        }),
      ),
    }),
  ]),
});
export type EditInput = z.input<typeof EditRequest>;
export type EditPreview = {
  plan: TripPlan;
  baseVersion: number;
  routes: RouteResult[];
  differences: string[];
  blockers: string[];
};
const mins = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const hhmm = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
export async function previewEdit(
  input: unknown,
  deps = { googleRoute, placeDetails, timeZone },
): Promise<EditPreview> {
  const { plan, baseVersion, operation, mode } = EditRequest.parse(input);
  if ((plan.editVersion ?? 0) !== baseVersion)
    throw new Error("This edit is stale. Start from the current plan.");
  if (
    plan.tripId !== plan.brief.tripId ||
    plan.sections.some((s) => s.proposal && s.proposal.agent !== s.id)
  )
    throw new Error("Plan identifiers do not match. Restore or replan first.");
  const section = plan.sections.find((s) => s.id === "itinerary");
  if (!section?.proposal) throw new Error("There are no activities to edit.");
  const activities = section.proposal.items.filter((i) => i.kind === "activity");
  const before = structuredClone(activities);
  if (
    activities.some((i) => !i.id || !i.day || !i.startTime || !i.endTime) ||
    new Set(activities.map((i) => i.id)).size !== activities.length
  )
    throw new Error("Activities need unique IDs and a complete schedule before editing.");
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
      throw new Error("Undo activities do not match this plan.");
    const restored: ProposalItem[] = operation.activities.map((saved) => {
      const item = activities.find((a) => a.id === saved.id);
      if (!item || !segment(item.day!) || segment(saved.day) !== segment(item.day!))
        throw new Error("Undo cannot change destination segments.");
      affected.add(saved.day);
      affected.add(item.day!);
      return {
        ...item,
        ...saved,
        placeId: saved.placeId,
        priceNeedsReview: saved.priceNeedsReview,
      };
    });
    activities.splice(0, activities.length, ...restored);
  } else {
    const item = activities.find((a) => a.id === operation.id);
    if (!item) throw new Error("Activity not found.");
    affected.add(item.day!);
    if (operation.kind === "move") {
      if (
        operation.day > days ||
        !segment(item.day!) ||
        segment(item.day!) !== segment(operation.day)
      )
        throw new Error("Move must stay within the same destination accommodation segment.");
      const target = activities.filter((a) => a.day === operation.day && a.id !== item.id);
      if (operation.index > target.length) throw new Error("Invalid activity position.");
      anchor = {
        day: operation.day,
        index: operation.index,
        time: target[operation.index]?.startTime ?? target.at(-1)?.endTime ?? "09:00",
      };
      activities.splice(activities.indexOf(item), 1);
      item.day = operation.day;
      const next = target[operation.index];
      const insert = next
        ? activities.indexOf(next)
        : target.length
          ? activities.indexOf(target.at(-1)!) + 1
          : activities.length;
      activities.splice(insert, 0, item);
      affected.add(operation.day);
    } else if (operation.kind === "time") {
      if (operation.endTime <= operation.startTime)
        throw new Error("End time must be after start time on the same day.");
      item.startTime = operation.startTime;
      item.endTime = operation.endTime;
    } else {
      await deps.placeDetails(operation.placeId);
      item.placeId = operation.placeId;
      item.priceNeedsReview = true;
      // Provider display text is deliberately kept outside the persisted plan.
    }
  }
  const routes: RouteResult[] = [],
    blockers: string[] = [];
  for (const day of affected) {
    if (day < 1 || day > days) throw new Error("Activity day is outside trip dates.");
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
        : operation.kind === "time" || operation.kind === "place"
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
      if (previous) {
        if (!previous.placeId || !current.placeId) {
          blockers.push(`Day ${day}: select verified Google places before automatic routing.`);
          break;
        }
        try {
          const place = await deps.placeDetails(previous.placeId);
          const zone = await deps.timeZone(place, dateFor(day));
          const departure = localInstant(dateFor(day), previous.endTime!, zone);
          const route = await deps.googleRoute(previous.placeId, current.placeId, departure, mode);
          routes.push(route);
          if (
            route.status !== "ok" ||
            route.durationMin === undefined ||
            !Number.isFinite(route.durationMin) ||
            route.durationMin <= 0
          ) {
            blockers.push(route.error ?? "Route unavailable");
            break;
          }
          const earliest = mins(previous.endTime!) + route.durationMin + 15;
          const keepExact =
            operation.kind === "undo" ||
            operation.kind === "verify" ||
            index < changedIndex ||
            (operation.kind === "time" && index === changedIndex);
          if (keepExact) {
            if (start < earliest)
              blockers.push(
                `Day ${day}: ${current.detail} needs at least ${route.durationMin + 15} minutes after the previous activity.`,
              );
          } else start = Math.max(start, earliest);
        } catch (error) {
          blockers.push(error instanceof Error ? error.message : "Route verification failed");
          break;
        }
      }
      if (start + duration >= 1440) {
        blockers.push(`Day ${day}: activity would extend beyond the day.`);
        break;
      }
      current.startTime = hhmm(start);
      current.endTime = hhmm(start + duration);
    }
  }
  const unresolved =
    operation.kind !== "move"
      ? blockers.filter((message) => !message.includes("beyond the day"))
      : [];
  if (operation.kind !== "move")
    blockers.splice(
      0,
      blockers.length,
      ...blockers.filter((message) => message.includes("beyond the day")),
    );
  section.proposal.items = [
    ...section.proposal.items.filter((i) => i.kind !== "activity"),
    ...activities,
  ];
  const affectedIds = new Set(activities.filter((a) => affected.has(a.day!)).map((a) => a.id!));
  const retainedIssues = (plan.editIssues ?? []).filter(
    (issue) =>
      issue.code !== "price_unverified" && !issue.activityIds.some((id) => affectedIds.has(id)),
  );
  const oldIssueMessages = new Set((plan.editIssues ?? []).map((issue) => issue.message));
  const retainedLegacy = section.proposal.conflictsWith.filter((message) => {
    if (oldIssueMessages.has(message) || message === "Changed activity price requires verification")
      return false;
    const namedDay = /day (\d+)/i.exec(message);
    return namedDay ? !affected.has(Number(namedDay[1])) : activities.some((a) => !a.placeId);
  });
  section.proposal.conflictsWith = [
    ...new Set([...retainedLegacy, ...retainedIssues.map((issue) => issue.message)]),
    ...unresolved,
    ...(activities.some((a) => a.priceNeedsReview)
      ? ["Changed activity price requires verification"]
      : []),
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
        message: "Changed activity price requires verification",
        activityIds: [a.id!],
      })),
  ];
  plan.conflicts = detectConflicts(
    plan.sections.flatMap((s) => (s.proposal ? [s.proposal] : [])),
    plan.brief,
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
  const differences = activities.flatMap((a) => {
    const old = before.find((b) => b.id === a.id)!;
    return old.day !== a.day ||
      old.startTime !== a.startTime ||
      old.endTime !== a.endTime ||
      old.placeId !== a.placeId
      ? [
          `${a.detail}: day ${old.day} ${old.startTime}–${old.endTime} → day ${a.day} ${a.startTime}–${a.endTime}${old.placeId !== a.placeId ? " · place changed; price unverified" : ""}`,
        ]
      : [];
  });
  return { plan: TripPlan.parse(plan), baseVersion, routes, differences, blockers };
}
