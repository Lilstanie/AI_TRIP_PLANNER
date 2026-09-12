import {
  AgentProposal as AgentProposalSchema,
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type RevisionRequest,
  type ProposalItem,
  type RouteLeg,
  type Specialist,
  type TripBrief,
} from "@trip/shared";
import { createAgent, tool } from "langchain";
import { z } from "zod/v4";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays, routeProblem, fareUnavailable } from "./validation";

// Transport combines booking fares with map legs and keeps all pricing in the
// deterministic calculator that the specialist must call.
/** Parse the demo's ampersand-separated destination convention. */
function cities(destination: string): string[] {
  const result = destination
    .split(/\s*&\s*/)
    .map((city) => city.trim())
    .filter(Boolean);
  if (!result.length) throw new Error("Transport requires at least one destination.");
  return result;
}

/** Format a leg cursor as a same-day HH:mm value. */
function clock(totalMinutes: number): string {
  if (totalMinutes < 0 || totalMinutes >= 24 * 60) {
    throw new Error("A transport leg cannot fit inside one planning day.");
  }
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/** Search fares/routes and build a deterministic proposal for the trip. */
async function buildTransportProposal(
  briefInput: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const destinations = cities(brief.destination);
  const days = planningDays(brief.dates);
  const preferences = await ctx.mem.getLongTerm(brief.userId);
  const origin =
    preferences.find((preference) => preference.key === "transport.origin")?.value.trim() ||
    "Sydney";
  const budgetRevision =
    revision !== undefined &&
    /budget|cost|cheaper|overrun/i.test([revision.reason, ...revision.constraints].join(" "));
  const scheduleRevision = revision !== undefined && /time|overlap|schedule/i.test(revision.reason);

  const routeQueries = destinations.slice(1).map((destination, index) => ({
    from: destinations[index]!,
    to: destination,
    date: dateForDay(
      brief.dates[0],
      Math.min(days, Math.floor((days * (index + 1)) / destinations.length) + 1),
    ),
    day: Math.min(days, Math.floor((days * (index + 1)) / destinations.length) + 1),
  }));
  // A single-city trip still gets an arrival transfer when the origin matches
  // the destination, keeping the proposal useful without inventing a flight.
  if (origin.toLowerCase() === destinations[0]!.toLowerCase() && routeQueries.length === 0) {
    routeQueries.push({
      from: `${destinations[0]} airport`,
      to: destinations[0]!,
      date: brief.dates[0],
      day: 1,
    });
  }

  const conflicts: string[] = [];
  const [flightOptions, routed] = await Promise.all([
    origin.toLowerCase() === destinations[0]!.toLowerCase()
      ? Promise.resolve([])
      : ctx.tools.booking
          .searchFlights({
            from: origin,
            to: destinations[0]!,
            depart: brief.dates[0],
            return: brief.dates[1],
            passengers: brief.groupSize,
          })
          .catch(() => {
            ctx.signal?.throwIfAborted();
            conflicts.push("Flight provider unavailable; required flight remains unpriced.");
            return [];
          }),
    Promise.all(
      routeQueries.map(async (query) => {
        try {
          return { query, legs: await ctx.tools.maps.route(query) };
        } catch {
          ctx.signal?.throwIfAborted();
          conflicts.push(
            `geography conflict on day ${query.day}: route provider unavailable for ${query.from} → ${query.to}`,
          );
          return { query, legs: [] as RouteLeg[] };
        }
      }),
    ),
  ]);
  ctx.signal?.throwIfAborted();

  const validFlights = flightOptions.filter(
    (option) => Number.isFinite(option.priceUsd) && option.priceUsd >= 0 && option.carrier.trim(),
  );
  if (origin.toLowerCase() !== destinations[0]!.toLowerCase() && !validFlights.length)
    conflicts.push("Required flight has no valid fare; transport estimate is incomplete.");
  const flight = validFlights.length
    ? budgetRevision
      ? [...validFlights].sort((left, right) => left.priceUsd - right.priceUsd)[0]
      : (validFlights.find((option) => /flex/i.test(option.carrier)) ?? validFlights[0])
    : undefined;
  const routeStart = scheduleRevision ? 6 * 60 : 9 * 60;
  // Convert each returned map leg into sequential, same-day transport items.
  const routeItems: ProposalItem[] = routed.flatMap(({ query, legs }) => {
    const problem = routeProblem(legs);
    if (problem) {
      conflicts.push(
        `geography conflict on day ${query.day}: ${query.from} → ${query.to}: ${problem}`,
      );
      return [];
    }
    let cursor = routeStart;
    if (cursor + legs.reduce((sum, leg) => sum + Math.ceil(leg.durationMin), 0) >= 1440) {
      conflicts.push(`time conflict on day ${query.day}: route cannot fit inside one planning day`);
      return [];
    }
    return legs.map((leg) => {
      const startTime = clock(cursor);
      cursor += Math.ceil(leg.durationMin);
      const endTime = clock(cursor);
      const unknownFare = fareUnavailable(leg);
      if (unknownFare) {
        conflicts.push(
          `Transport fare unavailable on day ${query.day}: budget total is incomplete, not a free trip.`,
        );
      }
      return {
        kind: "transport",
        day: query.day,
        startTime,
        endTime,
        location: `${query.from} → ${query.to}`,
        detail: `${leg.mode} from ${query.from} to ${query.to} on ${query.date}; ${leg.durationMin} minutes${leg.note ? `; ${leg.note}` : ""}.`,
        ...(unknownFare ? {} : { estCost: leg.priceUsd }),
      };
    });
  });
  const items = [
    ...(flight
      ? [
          {
            kind: "transport",
            day: 1,
            location: `${origin} → ${destinations[0]}`,
            detail: `${flight.carrier}: ${origin} to ${destinations[0]}, returning ${brief.dates[1]}; whole-group fare${flight.note ? `; ${flight.note}` : ""}.`,
            estCost: flight.priceUsd,
          },
        ]
      : []),
    ...routeItems,
  ];
  const total = items.reduce((sum, item) => sum + (item.estCost ?? 0), 0);
  return {
    agent: "transport",
    summary: `${items.length} transport option(s) for ${origin} ↔ ${destinations.join(" → ")} · known estimate USD ${total.toFixed(2)}${conflicts.length ? " (incomplete/unverified)" : ""}`,
    items,
    assumptions: [
      "Route arrays are consecutive legs; calculator preserves adapter USD amounts as group totals, matching the current integration. Per-person providers must normalize fares before returning them.",
      "Inter-city route dates follow their scheduled day. Unsupported driving-only estimates cannot verify public transport.",
      `Origin defaults to Sydney unless long-term preference "transport.origin" is set; current origin: ${origin}.`,
      "Injected booking and maps results are treated as estimates, not reservations or live availability.",
      ...(budgetRevision ? ["Budget revision selected the lowest returned flight fare."] : []),
      ...(scheduleRevision ? ["Schedule revision moved routed legs to an early departure."] : []),
    ],
    conflictsWith: [...new Set(conflicts)],
  };
}

async function planTransport(
  brief: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  // Prefer the model only as a narrator; all evidence, selections and costs are
  // produced by buildTransportProposal and exposed through one calculator tool.
  const model = createRoutedChatModel("transport");
  if (!model) return buildTransportProposal(brief, ctx, revision);

  let evidence: AgentProposal | undefined;
  const calculate = tool(
    async () => {
      evidence = AgentProposalSchema.parse(await buildTransportProposal(brief, ctx, revision));
      return evidence;
    },
    {
      name: "calculate_transport_options",
      description:
        "Search the injected booking/maps ports and calculate a validated transport proposal for this trip and revision.",
      schema: z.object({}),
    },
  );
  const specialist = createAgent({
    name: "transport_specialist",
    model,
    tools: [calculate],
    systemPrompt:
      "You are the transport specialist. Always call calculate_transport_options. Return its proposal unchanged: do not invent carriers, routes, prices, schedules or availability. The calculator owns all selection, costing and revision rules. Return the requested structured AgentProposal.",
    responseFormat: AgentProposalSchema,
  });
  try {
    const result = await specialist.invoke({
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Return the calculated transport proposal.",
            tripId: brief.tripId,
            revision: revision?.reason,
          }),
        },
      ],
    });
    const proposal = readStructuredResponse("transport", AgentProposalSchema, result);
    if (proposal.agent !== "transport" || !evidence) {
      throw new Error("Transport specialist returned the wrong proposal type or skipped its tool.");
    }
    // A valid schema does not prove that prices/routes still match the calculator.
    // Keep all tool-owned fields authoritative, even if the model rewrites them.
    return evidence;
  } catch (error) {
    ctx.signal?.throwIfAborted();
    const reason = error instanceof Error ? error.message : "unknown model error";
    console.warn(`[transport] Specialist failed; using a safe local plan: ${reason}`);
    return evidence ?? buildTransportProposal(brief, ctx, revision);
  }
}

// Default registry entry; revisions are routed through the same planner above.
export const transportAgent: Specialist = {
  name: "transport",
  label: "Getting around",
  supportsRevision: true,
  async invoke({ brief, context, revision }) {
    if (revision) {
      if (revision.tripId !== brief.tripId || revision.targetAgent !== "transport") {
        throw new Error("Transport revision must target this trip and agent.");
      }
    }
    return planTransport(brief, context, revision);
  },
};
