import {
  AgentProposal as AgentProposalSchema,
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type RevisionRequest,
  type ProposalItem,
  type RouteLeg,
  type RouteOption,
  type Specialist,
  type TripBrief,
  type FlightOption,
} from "@trip/shared";
import { createAgent, tool } from "langchain";
import { z } from "zod/v4";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays, routeProblem, fareUnavailable } from "./validation";
import { journeyLegs, flightLegs, groundLegs, type JourneyLeg } from "./legs";
import { mockEnabled } from "@trip/tools";

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

interface RouteQuery {
  localTime: string;
  from: string;
  to: string;
  date: string;
  day: number;
}

interface TransportEvidence {
  brief: TripBrief;
  origin: string;
  destinations: string[];
  /** Every hop in travel order; the single source of truth for the itinerary. */
  legs: JourneyLeg[];
  days: number;
  budgetRevision: boolean;
  scheduleRevision: boolean;
  flights: FlightOption[];
  routed: { query: RouteQuery; legs: RouteLeg[]; options: RouteOption[] }[];
  conflicts: string[];
}

/**
 * Run the provider searches once and return what they gave back, undecided.
 *
 * Note the day and departure time are inputs to the route query, so this searches at the
 * deterministic default. A caller that reassigns a hop to another day or hour keeps these
 * durations; for the mock and OSRM adapters they do not vary by departure time, but a real transit
 * provider's would. That approximation is the price of letting the schedule be chosen after the
 * search rather than before it.
 */
async function gatherTransportEvidence(
  briefInput: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<TransportEvidence> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const destinations = cities(brief.destination);
  const days = planningDays(brief.dates);
  const preferences = await ctx.mem.getLongTerm(brief.userId);
  // The brief is what the traveller actually stated this trip; the long-term
  // preference is a standing default for people who always leave from the same
  // city. The literal remains only so a brief that states neither still plans.
  const origin =
    brief.origin?.trim() ||
    preferences.find((preference) => preference.key === "transport.origin")?.value.trim() ||
    "Sydney";
  const budgetRevision =
    revision !== undefined &&
    /budget|cost|cheaper|overrun/i.test([revision.reason, ...revision.constraints].join(" "));
  const scheduleRevision = revision !== undefined && /time|overlap|schedule/i.test(revision.reason);

  const legs = journeyLegs({ origin, destinations, start: brief.dates[0], days });
  const routeQueries: RouteQuery[] = groundLegs(legs).map((leg) => ({
    localTime: scheduleRevision ? "06:00" : "09:00",
    from: leg.from,
    to: leg.to,
    date: leg.date,
    day: leg.day,
  }));
  const flown = flightLegs(legs);

  const conflicts: string[] = [];
  // One flown hop today. When legMode() starts flying later hops this becomes a
  // search per leg; the leg list it would map over already exists.
  const flightLeg = flown[0];
  const [flightOptions, routed] = await Promise.all([
    !flightLeg
      ? Promise.resolve([])
      : ctx.tools.booking
          .searchFlights({
            from: flightLeg.from,
            to: flightLeg.to,
            depart: flightLeg.date,
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
        // The legs set the schedule; the options only describe the choice. A
        // missing comparison must not cost the hop its timing, so they are
        // gathered independently and an options failure is silent.
        const options = ctx.tools.maps.routeOptions
          ? await ctx.tools.maps.routeOptions(query).catch(() => [] as RouteOption[])
          : [];
        try {
          return { query, legs: await ctx.tools.maps.route(query), options };
        } catch {
          ctx.signal?.throwIfAborted();
          conflicts.push(
            `geography conflict on day ${query.day}: route provider unavailable for ${query.from} → ${query.to}`,
          );
          return { query, legs: [] as RouteLeg[], options };
        }
      }),
    ),
  ]);
  ctx.signal?.throwIfAborted();

  const flights = flightOptions.filter(
    (option) => Number.isFinite(option.price) && option.price >= 0 && option.carrier.trim(),
  );
  if (flightLeg && !flights.length)
    conflicts.push("Required flight has no valid fare; transport estimate is incomplete.");

  return {
    brief,
    origin,
    destinations,
    legs,
    days,
    budgetRevision,
    scheduleRevision,
    flights,
    routed,
    conflicts,
  };
}

/**
 * Lay one hop's consecutive legs out from `startMinutes` on `day`, costing each from the leg's own
 * fare. Returns nothing and records a conflict when the hop cannot be scheduled -- an unroutable or
 * overlong hop is a gap in the plan, not a free one.
 */
/**
 * How else this hop could be made, in one line.
 *
 * Costs are quoted with their basis rather than as bare numbers: Google gives
 * real road tolls in AUD but no Australian transit fare, so an unqualified "$0
 * bus" next to a "$13.29 drive" would read as the bus being free rather than
 * unpriced. Only the scheduled leg's cost reaches the budget; these are shown
 * so the traveller can make the trade the planner did not make for them.
 */
function alternativesLine(options: RouteOption[]): string | undefined {
  if (options.length < 2) return undefined;
  const described = options.map((option) => {
    const price =
      option.priceBasis === "unavailable"
        ? "fare not published"
        : option.priceBasis === "partial"
          ? `from A$${option.price.toFixed(2)}`
          : `A$${option.price.toFixed(2)}`;
    return `${option.mode} ${option.durationMin} min, ${price}`;
  });
  return `Ways to make this hop: ${described.join("; ")}`;
}

function layOutHop(
  query: RouteQuery,
  legs: RouteLeg[],
  options: RouteOption[],
  day: number,
  startMinutes: number,
  tripStart: string,
  conflicts: string[],
): ProposalItem[] {
  // The date has to follow the day that was chosen, not the day this hop happened to be
  // searched on. Reporting the search date next to a reassigned day is simply wrong.
  const date = dateForDay(tripStart, day);
  const problem = routeProblem(legs);
  if (problem) {
    conflicts.push(`geography conflict on day ${day}: ${query.from} → ${query.to}: ${problem}`);
    return [];
  }
  let cursor = startMinutes;
  if (cursor + legs.reduce((sum, leg) => sum + Math.ceil(leg.durationMin), 0) >= 1440) {
    conflicts.push(`time conflict on day ${day}: route cannot fit inside one planning day`);
    return [];
  }
  const alternatives = alternativesLine(options);
  return legs.map((leg, index) => {
    const startTime = clock(cursor);
    const durationMin = Math.ceil(leg.durationMin);
    cursor += durationMin;
    const endTime = clock(cursor);
    const unknownFare = fareUnavailable(leg);
    if (unknownFare) {
      conflicts.push(
        `Transport fare unavailable on day ${day}: budget total is incomplete, not a free trip.`,
      );
    }
    return {
      kind: "transport",
      day,
      startTime,
      endTime,
      location: `${query.from} → ${query.to}`,
      detail: `${leg.mode} from ${query.from} to ${query.to} on ${date}; ${durationMin} minutes${leg.note ? `; ${leg.note}` : ""}.${
        // Only on the first leg of a hop: the comparison is for the hop, not
        // for each of its segments.
        index === 0 && alternatives ? ` ${alternatives}` : ""
      }`,
      ...(unknownFare ? {} : { estCost: leg.price }),
    };
  });
}

interface TransportPlan {
  flight?: { carrier: string; price: number; note?: string };
  /** One entry per routed hop, in the order they were searched. */
  schedule: { day: number; startMinutes: number }[];
  extraAssumptions: string[];
}

function transportSource(
  evidence: TransportEvidence,
  degraded = false,
): NonNullable<AgentProposal["source"]> {
  if (degraded) {
    return {
      kind: "fallback",
      label: "Local fallback",
      freshness:
        "The model schedule was unavailable or invalid; a deterministic transport plan was used from the gathered evidence.",
    };
  }
  const requiresFlight = flightLegs(evidence.legs).length > 0;
  if (requiresFlight && !evidence.flights.length) {
    return {
      kind: "unavailable",
      label: "Flight provider",
      freshness: "No valid flight fare was available; transport remains incomplete and unpriced.",
    };
  }
  if (mockEnabled()) {
    return {
      kind: "mock",
      label: "Mock booking and route data",
      freshness: "Fares and route details are deterministic fixtures; not live verified.",
    };
  }
  const flightProvenance = evidence.flights
    .map((flight) => flight.provenance)
    .filter((value): value is NonNullable<FlightOption["provenance"]> => value !== undefined);
  if (flightProvenance.length) {
    const providers = [...new Set(flightProvenance.map((value) => value.provider))];
    const queriedAt = [...new Set(flightProvenance.map((value) => value.queriedAt).filter(Boolean))];
    const allLive = flightProvenance.every((value) => value.kind === "live");
    const fallback = flightProvenance.find((value) => value.fallbackFrom);
    return {
      kind: allLive ? "live" : "estimated",
      label: providers.join(" + "),
      freshness: [
        `Flight fares are ${allLive ? "live" : "estimated"} search results in AUD; availability can change.`,
        queriedAt.length ? `Queried at ${queriedAt.join(", ")}.` : "",
        fallback
          ? `${fallback.fallbackFrom} was unavailable (${fallback.fallbackReason}); a fallback provider was used.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  if (process.env.SERPAPI_KEY && evidence.flights.length) {
    return {
      kind: "live",
      label: "SerpApi Google Flights + Maps",
      freshness: "Flight fares are live search results at query time; route timings remain provider estimates and availability can change.",
    };
  }
  return {
    kind: "estimated",
    label: "Maps route estimates",
    freshness: "Route details are provider estimates; no live flight fare was included.",
  };
}

/** Turn a chosen flight and schedule into the costed proposal. */
function assembleTransportProposal(
  evidence: TransportEvidence,
  plan: TransportPlan,
  degraded = false,
): AgentProposal {
  const { origin, destinations, brief, budgetRevision, scheduleRevision } = evidence;
  const flownLeg = flightLegs(evidence.legs)[0];
  const conflicts = [...evidence.conflicts];
  const routeItems = evidence.routed.flatMap(({ query, legs, options }, index) => {
    const slot = plan.schedule[index] ?? { day: query.day, startMinutes: 9 * 60 };
    return layOutHop(query, legs, options, slot.day, slot.startMinutes, brief.dates[0], conflicts);
  });
  const items = [
    // A fare only exists because a leg was flown, so the two travel together
    // rather than each falling back to the first destination on its own.
    ...(plan.flight && flownLeg
      ? [
          {
            kind: "transport",
            day: flownLeg.day,
            location: `${flownLeg.from} → ${flownLeg.to}`,
            detail: `${plan.flight.carrier}: ${flownLeg.from} to ${flownLeg.to}, returning ${brief.dates[1]}; whole-group fare${plan.flight.note ? `; ${plan.flight.note}` : ""}.`,
            estCost: plan.flight.price,
          },
        ]
      : []),
    ...routeItems,
  ];
  const total = items.reduce((sum, item) => sum + (item.estCost ?? 0), 0);
  return {
    agent: "transport",
    summary: `${items.length} transport option(s) for ${origin} ↔ ${destinations.join(" → ")} · known estimate AUD ${total.toFixed(2)}${conflicts.length ? " (incomplete/unverified)" : ""}`,
    items,
    assumptions: [
      "Route arrays are consecutive legs; calculator preserves adapter AUD amounts as group totals, matching the current integration. Per-person providers must normalize fares before returning them.",
      "Inter-city route dates follow their scheduled day. Unsupported driving-only estimates cannot verify public transport.",
      `Origin comes from the trip brief, else the long-term preference "transport.origin", else Sydney; current origin: ${origin}.`,
      "Injected booking and maps results are treated as estimates, not reservations or live availability.",
      ...(budgetRevision ? ["Budget revision selected the lowest returned flight fare."] : []),
      ...(scheduleRevision ? ["Schedule revision moved routed legs to an early departure."] : []),
      ...plan.extraAssumptions,
    ],
    conflictsWith: [...new Set(conflicts)].sort((a, b) => a.localeCompare(b)),
    source: transportSource(evidence, degraded),
  };
}

/** The deterministic choice: kept as the no-key path and as the fallback from the model path. */
function deterministicPlan(evidence: TransportEvidence): TransportPlan {
  const { flights, budgetRevision, scheduleRevision, routed } = evidence;
  const flight = flights.length
    ? budgetRevision
      ? [...flights].sort((left, right) => left.price - right.price)[0]
      : (flights.find((option) => /flex/i.test(option.carrier)) ?? flights[0])
    : undefined;
  const startMinutes = scheduleRevision ? 6 * 60 : 9 * 60;
  return {
    flight,
    schedule: routed.map(({ query }) => ({ day: query.day, startMinutes })),
    extraAssumptions: [],
  };
}

/** Search fares/routes and build a deterministic proposal for the trip. */
async function buildTransportProposal(
  briefInput: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  const evidence = await gatherTransportEvidence(briefInput, ctx, revision);
  return assembleTransportProposal(evidence, deterministicPlan(evidence));
}

/**
 * What the specialist decides: which flight, and when each hop runs. No money field anywhere --
 * fares come from the candidate the model named, so an invented price has nowhere to land.
 */
const TransportSelection = z.object({
  flightId: z
    .string()
    .nullish()
    .describe("One of the offered flight ids, or null when none were offered"),
  schedule: z
    .array(
      z.object({
        hopId: z.string().describe("One of the offered hop ids"),
        day: z.number().int().describe("Planning day, starting at 1"),
        startTime: z.string().describe("Local departure time as HH:mm"),
      }),
    )
    .describe("One entry per offered hop"),
  guidance: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("Short traveller-facing notes about the schedule"),
});

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutesOf = (value: string): number | undefined => {
  const match = HHMM.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
};

async function planTransport(
  brief: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  const model = createRoutedChatModel("transport");
  if (!model) return buildTransportProposal(brief, ctx, revision);

  let evidence: TransportEvidence | undefined;
  const search = tool(
    async () => {
      evidence = await gatherTransportEvidence(brief, ctx, revision);
      return {
        planningDays: evidence.days,
        origin: evidence.origin,
        flights: evidence.flights.map((option, index) => ({
          flightId: `flight-${index}`,
          carrier: option.carrier,
          totalCost: option.price,
          note: option.note,
        })),
        hops: evidence.routed.map(({ query, legs }, index) => ({
          hopId: `hop-${index}`,
          from: query.from,
          to: query.to,
          totalMinutes: legs.reduce((sum, leg) => sum + Math.ceil(leg.durationMin), 0),
          modes: [...new Set(legs.map((leg) => leg.mode))],
        })),
      };
    },
    {
      name: "search_transport_evidence",
      description:
        "Search the injected booking and maps ports and return the flight candidates and inter-city hops for this trip, with their ids and real durations and fares. It does not choose.",
      schema: z.object({}),
    },
  );
  const specialist = createAgent({
    name: "transport_specialist",
    model,
    tools: [search],
    systemPrompt:
      "You are the transport specialist. Call search_transport_evidence, then decide two things: which flight candidate to take, and which planning day and local departure time each hop should run at. You own those choices -- weigh cost against the traveller's budget, and schedule hops so they leave enough of the day to be worth arriving for. A budget revision means prefer the cheapest flight; a schedule revision means move departures earlier. Refer to flights and hops only by the ids you were given. Never state a fare, a duration or a carrier of your own. Return the requested structured selection.",
    responseFormat: TransportSelection,
  });
  try {
    const result = await specialist.invoke({
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Choose the flight and schedule every hop.",
            tripId: brief.tripId,
            brief: {
              destination: brief.destination,
              dates: brief.dates,
              groupSize: brief.groupSize,
              budgetTotal: brief.budgetTotal,
            },
            revision: revision && { reason: revision.reason, constraints: revision.constraints },
          }),
        },
      ],
    });
    const selection = readStructuredResponse("transport", TransportSelection, result);
    if (!evidence) throw new Error("Transport specialist skipped its search tool.");
    const gathered = evidence;

    // Resolve the whole selection before using any of it: a half-understood answer should fall
    // back to the deterministic plan rather than mix a model day with a heuristic flight.
    const flightIndex = selection.flightId
      ? Number(/^flight-(\d+)$/.exec(selection.flightId)?.[1] ?? NaN)
      : -1;
    if (selection.flightId && !gathered.flights[flightIndex])
      throw new Error(`Transport specialist chose an unknown flight ${selection.flightId}.`);
    if (!selection.flightId && gathered.flights.length)
      throw new Error("Transport specialist declined to choose among offered flights.");

    const schedule = gathered.routed.map(({ query }, index) => {
      const entry = selection.schedule.find((slot) => slot.hopId === `hop-${index}`);
      const startMinutes = entry ? minutesOf(entry.startTime) : undefined;
      if (!entry || startMinutes === undefined)
        throw new Error(`Transport specialist did not schedule hop-${index}.`);
      if (!Number.isInteger(entry.day) || entry.day < 1 || entry.day > gathered.days)
        throw new Error(`Transport specialist scheduled hop-${index} outside the trip.`);
      void query;
      return { day: entry.day, startMinutes };
    });

    return assembleTransportProposal(gathered, {
      flight: flightIndex >= 0 ? gathered.flights[flightIndex] : undefined,
      schedule,
      extraAssumptions: (selection.guidance ?? [])
        .map((note) => note.trim())
        .filter((note) => note.length > 0),
    });
  } catch (error) {
    ctx.signal?.throwIfAborted();
    const reason = error instanceof Error ? error.message : "unknown model error";
    console.warn(`[transport] Specialist failed; using a safe local plan: ${reason}`);
    if (evidence) return assembleTransportProposal(evidence, deterministicPlan(evidence), true);
    const proposal = await buildTransportProposal(brief, ctx, revision);
    return {
      ...proposal,
      source: {
        kind: "fallback",
        label: "Local fallback",
        freshness: "The model schedule was unavailable; a deterministic transport plan was used from the gathered evidence.",
      },
    };
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
