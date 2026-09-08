// Owner: C — lodging proposals and price revisions via injected tools and memory.
import type { Agent, AgentProposal, TripBrief, AgentContext, RevisionRequest } from "@trip/shared";
import { chooseInitial, eligibleOptions, readPreferences, splitStay, stayCost } from "./planning";

async function planStays(
  brief: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const segments = splitStay(brief);
  const prefs = readPreferences(await ctx.mem.getLongTerm(brief.userId));
  ctx.signal?.throwIfAborted();
  const rooms =
    prefs.roomAllocation === "individual" ? brief.groupSize : Math.ceil(brief.groupSize / 2);
  const budgetRevision =
    revision !== undefined &&
    /budget|cost|cheaper|overrun/i.test([revision.reason, ...revision.constraints].join(" "));
  const selections = await Promise.all(
    segments.map(async (segment) => {
      const options = eligibleOptions(
        await ctx.tools.booking.searchStays({
          city: segment.city,
          checkIn: segment.checkIn,
          checkOut: segment.checkOut,
          guests: brief.groupSize,
        }),
        prefs,
      );
      ctx.signal?.throwIfAborted();
      if (!options.length) {
        // Do not present an unpriceable stay as a successful $0 proposal. A can map this to HITL.
        throw new Error(
          `No valid stays in ${segment.city} match the confirmed accommodation preferences.`,
        );
      }
      const initial = chooseInitial(options);
      const chosen = budgetRevision ? options[0]! : initial;
      return {
        segment,
        options,
        chosen,
        initialCost: stayCost(initial, segment.nights, rooms),
        cost: stayCost(chosen, segment.nights, rooms),
      };
    }),
  );
  const total = selections.reduce((sum, stay) => sum + Math.round(stay.cost * 100), 0) / 100;
  const initialTotal =
    selections.reduce((sum, stay) => sum + Math.round(stay.initialCost * 100), 0) / 100;
  const savings = Math.round((initialTotal - total) * 100) / 100;
  const assumptions = [
    "Booking mock convention: USD per room per night; at most 2 guests per room; availability is simulated.",
    `${prefs.roomAllocation} allocation: ${rooms} room(s) for ${brief.groupSize} guest(s); check-out day is not charged.`,
    "Only selected stays contribute to estCost. Taxes/fees are assumed included in mock rates.",
    "Initial selection prefers rating >=8/10 and free cancellation; confirmed preferences remain mandatory during revisions.",
    "Trip budget covers every agent; no accommodation budget allocation is assumed. Orchestrator checks the combined cost.",
    ...selections.map(
      ({ segment, options }) =>
        `${segment.city}: compared ${options.length} eligible option(s): ` +
        options
          .map(
            (option) =>
              `${option.name} (USD ${stayCost(option, segment.nights, rooms).toFixed(2)} total, ${option.rating}/10, ${option.freeCancellation ? "free cancellation" : "no free cancellation"})`,
          )
          .join("; ") +
        ". Only the selected option is charged.",
    ),
  ];
  if (segments.length > 1) {
    assumptions.push(
      "Cities separated by '&' are visited in listed order; nights are split evenly, with extras assigned to earlier cities. Confirm this schedule with the itinerary owner.",
    );
  }
  if (revision) {
    assumptions.push(
      `Revision requested: ${revision.reason}; constraints: ${revision.constraints.join("; ") || "none"}.`,
    );
    assumptions.push(
      budgetRevision
        ? `Selected the cheapest eligible stays; saved USD ${savings.toFixed(2)} against the initial selection for these inputs. Dates, guest count and confirmed preferences are unchanged.`
        : "No supported price revision was requested; the initial selection is retained. Time/geography changes require an updated brief.",
    );
    if (budgetRevision) {
      const match = revision.constraints
        .join(" ")
        .match(/cut accommodation cost by ~?(\d+(?:\.\d+)?)%/i);
      if (match && Number(match[1]) >= 0 && Number(match[1]) <= 100) {
        const target = Math.round(initialTotal * (1 - Number(match[1]) / 100) * 100) / 100;
        assumptions.push(
          `Requested target: USD ${target.toFixed(2)} or less. ${total <= target ? "Target met." : "Target cannot be met by eligible candidates; further budget decisions belong to the orchestrator."}`,
        );
      }
      if (savings === 0)
        assumptions.push(
          "No cheaper eligible stay is available; the estimate cannot be reduced further.",
        );
    }
  }
  return {
    agent: "accommodation",
    summary: `${rooms} room(s), ${segments.reduce((sum, segment) => sum + segment.nights, 0)} nights in ${segments.map((segment) => segment.city).join(" & ")} · USD ${total.toFixed(2)}${budgetRevision ? " (lowest eligible cost)" : ""}`,
    items: selections.map(({ segment, chosen, cost }) => ({
      kind: "hotel",
      day: segment.day,
      estCost: cost,
      location: `${chosen.name}, ${segment.city}`,
      detail: `${chosen.name} — ${chosen.area}; ${segment.checkIn} to ${segment.checkOut}; ${rooms} room(s) × ${segment.nights} night(s) × USD ${chosen.pricePerNightUsd.toFixed(2)} per room/night = USD ${cost.toFixed(2)}; rating ${chosen.rating}/10; ${chosen.freeCancellation ? "free cancellation" : "no free cancellation"}.`,
    })),
    assumptions,
    conflictsWith: [],
  };
}

export const accommodationAgent: Agent = {
  name: "accommodation",
  label: "Stay",
  run: (brief, ctx) => planStays(brief, ctx),
  async revise(brief, ctx, req) {
    if (req.tripId !== brief.tripId || req.targetAgent !== "accommodation") {
      throw new Error("Accommodation revision must target this trip and agent.");
    }
    return planStays(brief, ctx, req);
  },
};
