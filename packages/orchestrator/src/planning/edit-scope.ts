import type { AgentProposal } from "@trip/shared";

/**
 * Applies a traveller's itinerary edit without letting it spread: a deterministic fallback never
 * replaces a model-drafted itinerary (the edit is reported as not made instead), and when the edit
 * names its days, every other day keeps the stops it had before.
 */
export function scopedItineraryEdit(
  before: AgentProposal,
  after: AgentProposal,
  days?: readonly number[],
): AgentProposal {
  if (after.source?.kind === "fallback" && before.source?.kind !== "fallback") return before;
  if (!days?.length) return after;
  const edited = new Set(days);
  const items = [
    ...before.items.filter((item) => item.day === undefined || !edited.has(item.day)),
    ...after.items.filter((item) => item.day !== undefined && edited.has(item.day)),
  ].sort(
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
