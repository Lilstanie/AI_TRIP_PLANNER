import type { AgentProposal } from "@trip/shared";

export function scopedItineraryEdit(
  before: AgentProposal,
  after: AgentProposal,
  days?: readonly number[],
): AgentProposal {
  if (after.source?.kind === "fallback" && before.source?.kind !== "fallback") return before;
  if (!days?.length) return after;
  const edited = new Set(days);
  const kept = before.items.filter((item) => item.day === undefined || !edited.has(item.day));
  const keptPlaces = new Set(kept.map((item) => placeKey(item.location)).filter(Boolean));
  const added = after.items.filter(
    (item) =>
      item.day !== undefined && edited.has(item.day) && !keptPlaces.has(placeKey(item.location)),
  );
  const unchanged = before.items.filter(
    (item) =>
      item.day !== undefined &&
      edited.has(item.day) &&
      !added.some((next) => next.day === item.day),
  );
  const items = [...kept, ...unchanged, ...added].sort(
    (left, right) =>
      (left.day ?? 0) - (right.day ?? 0) ||
      (left.startTime ?? "").localeCompare(right.startTime ?? ""),
  );
  return {
    ...after,
    items,
    conflictsWith: [
      ...before.conflictsWith.filter((reason) => {
        const day = dayOf(reason);
        return day !== undefined && !edited.has(day);
      }),
      ...after.conflictsWith.filter((reason) => {
        const day = dayOf(reason);
        return day === undefined || edited.has(day);
      }),
    ],
  };
}

const dayOf = (reason: string) => {
  const day = /\bday (\d+)\b/.exec(reason)?.[1];
  return day === undefined ? undefined : Number(day);
};

const placeKey = (location: string | undefined) => location?.trim().toLocaleLowerCase() ?? "";
