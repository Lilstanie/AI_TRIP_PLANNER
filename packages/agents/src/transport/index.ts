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
import {
  dateForDay,
  planningDays,
  routeProblem,
  fareUnavailable,
  fitsInPlanningDay,
  hopDuration,
  EARLY_DEPARTURE_MINUTES,
  DEFAULT_DEPARTURE_MINUTES,
} from "./validation";
import {
  journeyLegs,
  flightLegs,
  groundLegs,
  flownInstead,
  type JourneyLeg,
} from "./legs";
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
  /** One entry per flown hop, in travel order. */
  flights: { leg: JourneyLeg; options: FlightOption[] }[];
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
  const conflicts: string[] = [];

  /** One flown hop, priced, with a provider failure recorded rather than hidden. */
  const priceFlight = async (leg: JourneyLeg) => {
    const options = await ctx.tools.booking
      .searchFlights({
        from: leg.from,
        to: leg.to,
        depart: leg.date,
        // Only the arrival is a return trip; a hop between cities is one way.
        ...(leg.index === 0 ? { return: brief.dates[1] } : {}),
        passengers: brief.groupSize,
      })
      .catch(() => {
        ctx.signal?.throwIfAborted();
        conflicts.push(
          `Flight provider unavailable; required flight ${leg.from} → ${leg.to} remains unpriced.`,
        );
        return [] as FlightOption[];
      });
    const valid = options.filter(
      (option) => Number.isFinite(option.price) && option.price >= 0 && option.carrier.trim(),
    );
    if (!valid.length)
      conflicts.push(
        `Required flight ${leg.from} → ${leg.to} has no valid fare; transport estimate is incomplete.`,
      );
    return { leg, options: valid };
  };

  /** One ground hop's scheduled legs, plus the alternatives to it. */
  const gatherGround = async (query: RouteQuery) => {
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
      return { query, legs: [] as RouteLeg[], options };
    }
  };

  // The arrival is known to be flown before any provider answers, so it is
  // priced alongside the ground lookups rather than after them.
  const arrival = flightLegs(legs)[0];
  const [arrivalPriced, groundResults] = await Promise.all([
    arrival ? priceFlight(arrival) : Promise.resolve(undefined),
    Promise.all(routeQueries.map(gatherGround)),
  ]);
  ctx.signal?.throwIfAborted();

  // A city hop whose scheduled ground journey cannot be travelled inside one
  // planning day is not a ground hop: the scheduler would reject it and the
  // traveller would get a conflict where a flight belongs. Promote it and price
  // it. The rule is the scheduler's own, so the two cannot disagree.
  const startMinutes = scheduleRevision ? EARLY_DEPARTURE_MINUTES : DEFAULT_DEPARTURE_MINUTES;
  const promoted = groundResults.filter(({ legs: hop }) => {
    if (!hop.length) return false;
    const duration = hopDuration(hop);
    // A duration that is not a number is a broken route, not a long one.
    // routeProblem already reports those; flying a hop because a provider
    // returned NaN would turn bad data into a purchase.
    return Number.isFinite(duration) && !fitsInPlanningDay(duration, startMinutes);
  });
  const promotedKeys = new Set(promoted.map(({ query }) => `${query.from}|${query.to}`));
  const promotedFlights = await Promise.all(
    promoted.map(({ query }) => {
      const leg = legs.find((candidate) => candidate.from === query.from && candidate.to === query.to);
      return priceFlight(flownInstead(leg ?? {
        index: legs.length,
        from: query.from,
        to: query.to,
        date: query.date,
        day: query.day,
        mode: "ground",
      }));
    }),
  );
  ctx.signal?.throwIfAborted();

  const routed = groundResults.filter(
    ({ query }) => !promotedKeys.has(`${query.from}|${query.to}`),
  );
  // Only a hop still travelled on the ground needs a ground route.
  for (const { query, legs: hop } of routed) {
    if (!hop.length)
      conflicts.push(
        `geography conflict on day ${query.day}: route provider unavailable for ${query.from} → ${query.to}`,
      );
  }
  const flights = [...(arrivalPriced ? [arrivalPriced] : []), ...promotedFlights];

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
  if (!fitsInPlanningDay(hopDuration(legs), cursor)) {
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
  /** The fare chosen for each flown hop, keyed by the hop's position. */
  flights: { legIndex: number; carrier: string; price: number; note?: string }[];
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
  // A hop was flown but came back with no fares. Checking the array's length
  // no longer answers this: it holds one entry per flown hop, present even
  // when that hop's fare list is empty.
  const unpricedHop = evidence.flights.some(({ options }) => options.length === 0);
  if (unpricedHop) {
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
    .flatMap(({ options }) => options)
    .map((option) => option.provenance)
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
  const conflicts = [...evidence.conflicts];
  const routeItems = evidence.routed.flatMap(({ query, legs, options }, index) => {
    const slot = plan.schedule[index] ?? { day: query.day, startMinutes: DEFAULT_DEPARTURE_MINUTES };
    return layOutHop(query, legs, options, slot.day, slot.startMinutes, brief.dates[0], conflicts);
  });
  // One item per flown hop. A fare exists only because a hop was flown, so the
  // two are matched by the hop's position rather than each resolving the route
  // on its own and risking a mismatched label.
  const flightItems = plan.flights.flatMap((fare) => {
    const leg = evidence.flights.find(({ leg: flown }) => flown.index === fare.legIndex)?.leg;
    if (!leg) return [];
    const returning = leg.index === 0 ? `, returning ${brief.dates[1]}` : "";
    return [
      {
        kind: "transport" as const,
        day: leg.day,
        location: `${leg.from} → ${leg.to}`,
        detail: `${fare.carrier}: ${leg.from} to ${leg.to}${returning}; whole-group fare${fare.note ? `; ${fare.note}` : ""}.`,
        estCost: fare.price,
      },
    ];
  });
  const items = [...flightItems, ...routeItems];
  // The fares each chosen flight beat, kept so the transcript can answer "why
  // this one?". Dropping them at the point of choice is what left Getting
  // around with a summary line where Stay shows a card.
  const flightSelections = plan.flights.flatMap((fare) => {
    const hop = evidence.flights.find(({ leg }) => leg.index === fare.legIndex);
    if (!hop?.options.length) return [];
    const candidates = hop.options.map((option, index) => ({
      id: `${hop.leg.index}-${index}`,
      carrier: option.carrier,
      price: option.price,
      ...(option.stops !== undefined ? { stops: option.stops } : {}),
      ...(option.durationMin !== undefined ? { durationMin: option.durationMin } : {}),
      ...(option.note ? { note: option.note } : {}),
    }));
    const selected =
      candidates.find(
        (candidate) => candidate.carrier === fare.carrier && candidate.price === fare.price,
      ) ?? candidates[0]!;
    return [
      {
        id: `flight-${hop.leg.index}`,
        from: hop.leg.from,
        to: hop.leg.to,
        depart: hop.leg.date,
        day: hop.leg.day,
        passengers: brief.groupSize,
        selectedId: selected.id,
        candidates,
      },
    ];
  });
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
    ...(flightSelections.length ? { flights: flightSelections } : {}),
    source: transportSource(evidence, degraded),
  };
}

/** The deterministic choice: kept as the no-key path and as the fallback from the model path. */
function deterministicPlan(evidence: TransportEvidence): TransportPlan {
  const { flights, budgetRevision, scheduleRevision, routed } = evidence;
  // One fare per flown hop, chosen the same way for each: the cheapest when
  // the plan is over budget, otherwise a flexible fare if one was offered.
  const chosen = flights.flatMap(({ leg, options }) => {
    if (!options.length) return [];
    const pick = budgetRevision
      ? [...options].sort((left, right) => left.price - right.price)[0]!
      : (options.find((option) => /flex/i.test(option.carrier)) ?? options[0]!);
    return [
      {
        legIndex: leg.index,
        carrier: pick.carrier,
        price: pick.price,
        ...(pick.note ? { note: pick.note } : {}),
      },
    ];
  });
  const startMinutes = scheduleRevision ? EARLY_DEPARTURE_MINUTES : DEFAULT_DEPARTURE_MINUTES;
  return {
    flights: chosen,
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
  flightIds: z
    .array(z.string())
    .nullish()
    .describe("One offered flight id per flown hop, or null when none were offered"),
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
        // Flattened for the model, but each fare still names the hop it is
        // for, so a chosen fare cannot be attached to the wrong leg.
        flights: evidence.flights.flatMap(({ leg, options }) =>
          options.map((option, index) => ({
            flightId: `flight-${leg.index}-${index}`,
            legIndex: leg.index,
            hop: `${leg.from} → ${leg.to}`,
            carrier: option.carrier,
            totalCost: option.price,
            note: option.note,
          })),
        ),
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
    const offered = gathered.flights.filter(({ options }) => options.length > 0);
    const chosenIds = selection.flightIds ?? [];
    const flights = chosenIds.map((id) => {
      const match = /^flight-(\d+)-(\d+)$/.exec(id);
      const legIndex = Number(match?.[1] ?? NaN);
      const optionIndex = Number(match?.[2] ?? NaN);
      const hop = gathered.flights.find(({ leg }) => leg.index === legIndex);
      const option = hop?.options[optionIndex];
      if (!option) throw new Error(`Transport specialist chose an unknown flight ${id}.`);
      return {
        legIndex,
        carrier: option.carrier,
        price: option.price,
        ...(option.note ? { note: option.note } : {}),
      };
    });
    // Exactly one fare per hop that had fares: fewer leaves a flown hop
    // unpriced, more would double-count one hop in the budget.
    const flownHops = new Set(offered.map(({ leg }) => leg.index));
    const pricedHops = new Set(flights.map((fare) => fare.legIndex));
    if (pricedHops.size !== flownHops.size || [...flownHops].some((index) => !pricedHops.has(index)))
      throw new Error("Transport specialist did not choose one fare for each flown hop.");
    if (flights.length !== pricedHops.size)
      throw new Error("Transport specialist chose more than one fare for a hop.");

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
      flights,
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
