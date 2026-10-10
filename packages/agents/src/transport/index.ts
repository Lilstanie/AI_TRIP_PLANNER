import {
  displayCurrencyOf,
  estimateNote,
  formatMoney,
  describeFlightChoice,
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type Currency,
  type RevisionRequest,
  type BudgetAllocation,
  type ProposalItem,
  type RouteLeg,
  type RouteOption,
  type Specialist,
  type TravelMode,
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
import { cities, journeyLegs, flightLegs, groundLegs, flownInstead, type JourneyLeg } from "./legs";
import { mockEnabled } from "@trip/tools";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";

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

  chosenMode?: TravelMode;
}

interface TransportEvidence {
  brief: TripBrief;

  currency: Currency;
  origin: string;
  destinations: string[];

  legs: JourneyLeg[];
  days: number;
  budgetRevision: boolean;
  scheduleRevision: boolean;

  allocation?: BudgetAllocation;

  flights: { leg: JourneyLeg; options: FlightOption[] }[];
  routed: { query: RouteQuery; legs: RouteLeg[]; options: RouteOption[] }[];
  conflicts: string[];
}

async function gatherTransportEvidence(
  briefInput: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
  allocation?: BudgetAllocation,
): Promise<TransportEvidence> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const destinations = cities(brief.destination);
  const days = planningDays(brief.dates);
  const preferences = await ctx.mem.getLongTerm(brief.userId);

  const origin =
    brief.origin?.trim() ||
    preferences.find((preference) => preference.key === "transport.origin")?.value.trim() ||
    "Sydney";
  const budgetRevision =
    revision !== undefined &&
    /budget|cost|cheaper|overrun/i.test([revision.reason, ...revision.constraints].join(" "));
  const scheduleRevision = revision !== undefined && /time|overlap|schedule/i.test(revision.reason);

  const legModes = brief.excludeFlights
    ? brief.legModes?.filter((choice) => choice.mode !== "flight")
    : brief.legModes;
  const legs = journeyLegs({ origin, destinations, start: brief.dates[0], days, legModes });
  const routeQueries: RouteQuery[] = groundLegs(legs).map((leg) => ({
    localTime: scheduleRevision ? "06:00" : "09:00",
    from: leg.from,
    to: leg.to,
    date: leg.date,
    day: leg.day,

    intercity: true,
    passengers: brief.groupSize,
    ...(leg.chosenMode ? { chosenMode: leg.chosenMode } : {}),
  }));
  const conflicts: string[] = [];

  const priceFlight = async (leg: JourneyLeg) => {
    if (brief.excludeFlights) return { leg, options: [] as FlightOption[] };
    const options = await ctx.tools.booking
      .searchFlights({
        from: leg.from,
        to: leg.to,
        depart: leg.date,

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

  const gatherGround = async (query: RouteQuery) => {
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

  const arrival = flightLegs(legs)[0];
  const [arrivalPriced, groundResults] = await Promise.all([
    arrival ? priceFlight(arrival) : Promise.resolve(undefined),
    Promise.all(routeQueries.map(gatherGround)),
  ]);
  ctx.signal?.throwIfAborted();

  const startMinutes = scheduleRevision ? EARLY_DEPARTURE_MINUTES : DEFAULT_DEPARTURE_MINUTES;
  const promoted = groundResults.filter(({ query, legs: hop }) => {
    if (!hop.length) return false;

    if (query.chosenMode) return false;
    const duration = hopDuration(hop);

    return Number.isFinite(duration) && !fitsInPlanningDay(duration, startMinutes);
  });
  const promotedKeys = new Set(promoted.map(({ query }) => `${query.from}|${query.to}`));
  const promotedFlights = await Promise.all(
    promoted.map(({ query }) => {
      const leg = legs.find(
        (candidate) => candidate.from === query.from && candidate.to === query.to,
      );
      return priceFlight(
        flownInstead(
          leg ?? {
            index: legs.length,
            from: query.from,
            to: query.to,
            date: query.date,
            day: query.day,
            mode: "ground",
          },
        ),
      );
    }),
  );
  ctx.signal?.throwIfAborted();

  const routed = groundResults.filter(
    ({ query }) => !promotedKeys.has(`${query.from}|${query.to}`),
  );

  for (const { query, legs: hop } of routed) {
    if (!hop.length)
      conflicts.push(
        `geography conflict on day ${query.day}: route provider unavailable for ${query.from} → ${query.to}`,
      );
  }
  const flights = [...(arrivalPriced ? [arrivalPriced] : []), ...promotedFlights];

  return {
    brief,
    currency: displayCurrencyOf(brief, ctx),
    origin,
    destinations,
    legs,
    days,
    budgetRevision,
    scheduleRevision,
    flights,
    routed,
    conflicts,
    ...(allocation ? { allocation } : {}),
  };
}

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

function scheduledLegs(
  legs: RouteLeg[],
  chosen: RouteOption | undefined,
): { leg: RouteLeg; unpriced: boolean }[] {
  if (chosen)
    return [
      {
        leg: {
          mode: chosen.mode,
          durationMin: chosen.durationMin,
          price: chosen.priceBasis === "unavailable" ? 0 : chosen.price,
          ...(chosen.note ? { note: chosen.note } : {}),
        },
        unpriced: chosen.priceBasis === "unavailable",
      },
    ];
  return legs.map((leg) => ({ leg, unpriced: fareUnavailable(leg) }));
}

function layOutHop(
  query: RouteQuery,
  legs: RouteLeg[],
  options: RouteOption[],
  day: number,
  startMinutes: number,
  tripStart: string,
  conflicts: string[],
  unmet: string[],
): ProposalItem[] {
  const date = dateForDay(tripStart, day);

  const alreadyChosen =
    query.chosenMode !== undefined &&
    legs.length > 0 &&
    legs.every((leg) => leg.mode === query.chosenMode);
  const chosen =
    query.chosenMode && !alreadyChosen
      ? options.find((option) => option.mode === query.chosenMode)
      : undefined;
  const honoured = alreadyChosen || chosen !== undefined;
  if (query.chosenMode && !honoured) {
    unmet.push(
      `${query.from} → ${query.to} by ${query.chosenMode} is not offered; it is planned as ${legs[0]?.mode ?? "the provider's route"} instead`,
    );
  }
  const scheduled = scheduledLegs(legs, chosen);
  const hopLegs = scheduled.map((entry) => entry.leg);
  const problem = routeProblem(hopLegs);
  if (problem) {
    conflicts.push(`geography conflict on day ${day}: ${query.from} → ${query.to}: ${problem}`);
    return [];
  }
  let cursor = startMinutes;
  if (!fitsInPlanningDay(hopDuration(hopLegs), cursor)) {
    conflicts.push(
      query.chosenMode
        ? `time conflict on day ${day}: ${query.from} → ${query.to} by ${query.chosenMode} cannot fit inside one planning day`
        : `time conflict on day ${day}: route cannot fit inside one planning day`,
    );
    return [];
  }
  const alternatives = alternativesLine(options);
  return scheduled.map(({ leg, unpriced }, index) => {
    const startTime = clock(cursor);
    const durationMin = Math.ceil(leg.durationMin);
    cursor += durationMin;
    const endTime = clock(cursor);

    return {
      kind: "transport",
      day,
      startTime,
      endTime,
      location: `${query.from} → ${query.to}`,
      detail: `${leg.mode} from ${query.from} to ${query.to} on ${date}; ${durationMin} minutes${leg.note ? `; ${leg.note}` : ""}.${
        honoured ? " Travelled this way because you chose it." : ""
      }${index === 0 && alternatives ? ` ${alternatives}` : ""}`,
      ...(unpriced ? {} : { estCost: leg.price }),
    };
  });
}

interface TransportPlan {
  flights: { legIndex: number; carrier: string; price: number; note?: string }[];

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
    const queriedAt = [
      ...new Set(flightProvenance.map((value) => value.queriedAt).filter(Boolean)),
    ];
    const allLive = flightProvenance.every((value) => value.kind === "live");
    const fallback = flightProvenance.find((value) => value.fallbackFrom);
    return {
      kind: allLive ? "live" : "estimated",
      label: providers.join(" + "),
      freshness: [
        `Flight fares are ${allLive ? "live" : "estimated"} search results in ${evidence.currency}; availability can change.`,
        estimateNote(evidence.currency),
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
      freshness:
        "Flight fares are live search results at query time; route timings remain provider estimates and availability can change.",
    };
  }
  return {
    kind: "estimated",
    label: "Maps route estimates",
    freshness: "Route details are provider estimates; no live flight fare was included.",
  };
}

function assembleTransportProposal(
  evidence: TransportEvidence,
  chosenPlan: TransportPlan,
  degraded = false,
): AgentProposal {
  const { origin, destinations, brief, budgetRevision, scheduleRevision, allocation, currency } =
    evidence;
  const conflicts = [...evidence.conflicts];

  const unmet: string[] = [];
  const routeItems = evidence.routed.flatMap(({ query, legs, options }, index) => {
    const slot = chosenPlan.schedule[index] ?? {
      day: query.day,
      startMinutes: DEFAULT_DEPARTURE_MINUTES,
    };
    return layOutHop(
      query,
      legs,
      options,
      slot.day,
      slot.startMinutes,
      brief.dates[0],
      conflicts,
      unmet,
    );
  });
  const groundCost = routeItems.reduce((sum, item) => sum + (item.estCost ?? 0), 0);
  const cheapest = cheapestFares(evidence);
  const cheapestCost = cheapest.reduce((sum, fare) => sum + fare.price, 0);

  const overAllocation =
    allocation !== undefined &&
    chosenPlan.flights.reduce((sum, fare) => sum + fare.price, 0) + groundCost > allocation.budget;
  const plan = overAllocation ? { ...chosenPlan, flights: cheapest } : chosenPlan;

  const flightItems = plan.flights.flatMap((fare) => {
    const leg = evidence.flights.find(({ leg: flown }) => flown.index === fare.legIndex)?.leg;
    if (!leg) return [];
    const returning = leg.index === 0 ? brief.dates[1] : undefined;
    return [
      {
        kind: "transport" as const,
        day: leg.day,
        selectionId: `flight-${leg.index}`,
        location: `${leg.from} → ${leg.to}`,
        detail: describeFlightChoice({
          from: leg.from,
          to: leg.to,
          carrier: fare.carrier,
          ...(fare.note ? { note: fare.note } : {}),
          ...(returning ? { returning } : {}),
        }),
        estCost: fare.price,
      },
    ];
  });
  const ownFlights = brief.excludeFlights
    ? evidence.flights.map(({ leg }) => ({
        kind: "transport" as const,
        day: leg.day,
        location: `${leg.from} → ${leg.to}`,
        detail: `Flight ${leg.from} to ${leg.to} arranged by you; not priced.`,
        estCost: undefined as number | undefined,
      }))
    : [];
  const items = [...ownFlights, ...flightItems, ...routeItems];

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

  const unpriced = items.filter((item) => item.estCost === undefined).length;
  return {
    agent: "transport",
    summary: `${items.length} transport option(s) for ${origin} ↔ ${destinations.join(" → ")} · known estimate ${formatMoney(total, currency)}${unpriced ? ` · ${unpriced} leg(s) unpriced` : ""}${unmet.length ? ` · ${unmet.length} travel choice(s) unavailable` : ""}${conflicts.length ? " (incomplete/unverified)" : ""}`,
    items,
    assumptions: [
      "Route arrays are consecutive legs; calculator preserves adapter AUD amounts as group totals, matching the current integration. Per-person providers must normalize fares before returning them.",
      "Inter-city route dates follow their scheduled day. Unsupported driving-only estimates cannot verify public transport.",
      `Origin comes from the trip brief, else the long-term preference "transport.origin", else Sydney; current origin: ${origin}.`,
      "Injected booking and maps results are treated as estimates, not reservations or live availability.",
      ...unmet.map(
        (note) => `You asked for ${note}. Name another mode and the plan will use it if it runs.`,
      ),
      ...(unpriced
        ? [
            `${unpriced} leg(s) carry no fare because the provider publishes none, so the known estimate is a floor rather than the full cost.`,
          ]
        : []),
      ...(budgetRevision ? ["Budget revision selected the lowest returned flight fare."] : []),
      ...(allocation
        ? [
            `Transport allocation: ${allocation.basis}.${overAllocation ? " The chosen fare was over it, so the cheapest returned fare was taken." : ""}`,
          ]
        : []),
      ...(scheduleRevision ? ["Schedule revision moved routed legs to an early departure."] : []),
      ...plan.extraAssumptions,
    ],
    conflictsWith: [...new Set(conflicts)].sort((a, b) => a.localeCompare(b)),
    floorCost: Math.round((cheapestCost + groundCost) * 100) / 100,
    ...(flightSelections.length ? { flights: flightSelections } : {}),
    source: transportSource(evidence, degraded),
  };
}

function cheapestFares(evidence: TransportEvidence): TransportPlan["flights"] {
  return evidence.flights.flatMap(({ leg, options }) => {
    if (!options.length) return [];
    const pick = [...options].sort((left, right) => left.price - right.price)[0]!;
    return [
      {
        legIndex: leg.index,
        carrier: pick.carrier,
        price: pick.price,
        ...(pick.note ? { note: pick.note } : {}),
      },
    ];
  });
}

function deterministicPlan(evidence: TransportEvidence): TransportPlan {
  const { flights, budgetRevision, scheduleRevision, routed } = evidence;

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

async function buildTransportProposal(
  briefInput: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
  allocation?: BudgetAllocation,
): Promise<AgentProposal> {
  const evidence = await gatherTransportEvidence(briefInput, ctx, revision, allocation);
  return assembleTransportProposal(evidence, deterministicPlan(evidence));
}

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
  allocation?: BudgetAllocation,
): Promise<AgentProposal> {
  const model = createRoutedChatModel("transport");
  if (!model) return buildTransportProposal(brief, ctx, revision, allocation);

  let evidence: TransportEvidence | undefined;
  const search = tool(
    async () => {
      evidence = await gatherTransportEvidence(brief, ctx, revision, allocation);
      return {
        planningDays: evidence.days,
        origin: evidence.origin,

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
      "You are the transport specialist. Call search_transport_evidence, then decide two things: which flight candidate to take, and which planning day and local departure time each hop should run at. You own those choices -- weigh cost against the traveller's budget, and schedule hops so they leave enough of the day to be worth arriving for. A budget revision means prefer the cheapest flight; a schedule revision means move departures earlier. Refer to flights and hops only by the ids you were given. Never state a fare, a duration or a carrier of your own. Return the requested structured selection. " +
      TRAVELLER_PREFERENCES_RULE,
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
              party: brief.party,
              budgetTotal: brief.budgetTotal,
              preferences: brief.preferences,
            },
            revision: revision && { reason: revision.reason, constraints: revision.constraints },
            ...(allocation
              ? {
                  transportBudget: {
                    maxTotalCost: allocation.budget,

                    currency: "AUD",
                    basis: allocation.basis,
                    basisCurrency: displayCurrencyOf(brief, ctx),
                  },
                }
              : {}),
          }),
        },
      ],
    });
    const selection = readStructuredResponse("transport", TransportSelection, result);
    if (!evidence) throw new Error("Transport specialist skipped its search tool.");
    const gathered = evidence;

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

    const flownHops = new Set(offered.map(({ leg }) => leg.index));
    const pricedHops = new Set(flights.map((fare) => fare.legIndex));
    if (
      pricedHops.size !== flownHops.size ||
      [...flownHops].some((index) => !pricedHops.has(index))
    )
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
    const proposal = await buildTransportProposal(brief, ctx, revision, allocation);
    return {
      ...proposal,
      source: {
        kind: "fallback",
        label: "Local fallback",
        freshness:
          "The model schedule was unavailable; a deterministic transport plan was used from the gathered evidence.",
      },
    };
  }
}

export const transportAgent: Specialist = {
  name: "transport",
  label: "Getting around",
  supportsRevision: true,
  async invoke({ brief, context, revision, allocation }) {
    if (revision) {
      if (revision.tripId !== brief.tripId || revision.targetAgent !== "transport") {
        throw new Error("Transport revision must target this trip and agent.");
      }
    }
    return planTransport(brief, context, revision, allocation);
  },
};
