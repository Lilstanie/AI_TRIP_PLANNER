import {
  TripBrief as TripBriefSchema,
  splitDestinationSchedule,
  type Agent,
  type AgentContext,
  type AgentProposal,
  type RevisionRequest,
  type TripBrief,
} from "@trip/shared";

const DAY_MS = 86_400_000;

function tripDays([start, end]: [string, string]): number {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS);
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Transport requires ordered dates.");
  return days;
}

function clock(totalMinutes: number): string {
  if (totalMinutes < 0 || totalMinutes >= 24 * 60) {
    throw new Error("A transport leg cannot fit inside one planning day.");
  }
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

async function planTransport(
  briefInput: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const start = Date.parse(`${brief.dates[0]}T00:00:00.000Z`);
  const schedule = splitDestinationSchedule(brief.destination, tripDays(brief.dates)).map(
    (segment) => ({
      city: segment.city,
      checkIn: new Date(start + (segment.startDay - 1) * DAY_MS).toISOString().slice(0, 10),
      day: segment.startDay,
    }),
  );
  const destinations = schedule.map((stay) => stay.city);
  const preferences = await ctx.mem.getLongTerm(brief.userId);
  const origin =
    preferences.find((preference) => preference.key === "transport.origin")?.value.trim() ||
    "Sydney";
  const budgetRevision =
    revision !== undefined &&
    /budget|cost|cheaper|overrun/i.test([revision.reason, ...revision.constraints].join(" "));
  const scheduleRevision = revision !== undefined && /time|overlap|schedule/i.test(revision.reason);

  const routeQueries = schedule.slice(1).map((stay, index) => ({
    from: destinations[index]!,
    to: stay.city,
    date: stay.checkIn,
    day: stay.day,
  }));
  if (origin.toLowerCase() === destinations[0]!.toLowerCase() && routeQueries.length === 0) {
    routeQueries.push({
      from: `${destinations[0]} airport`,
      to: destinations[0]!,
      date: brief.dates[0],
      day: 1,
    });
  }

  const [flightOptions, routed] = await Promise.all([
    origin.toLowerCase() === destinations[0]!.toLowerCase()
      ? Promise.resolve([])
      : ctx.tools.booking.searchFlights({
          from: origin,
          to: destinations[0]!,
          depart: brief.dates[0],
          return: brief.dates[1],
          passengers: brief.groupSize,
        }),
    Promise.all(
      routeQueries.map(async (query) => ({ query, legs: await ctx.tools.maps.route(query) })),
    ),
  ]);
  ctx.signal?.throwIfAborted();

  const flight = flightOptions.length
    ? budgetRevision
      ? [...flightOptions].sort((left, right) => left.priceUsd - right.priceUsd)[0]
      : (flightOptions.find((option) => /flex/i.test(option.carrier)) ?? flightOptions[0])
    : undefined;
  const routeStart = scheduleRevision ? 6 * 60 : 9 * 60;
  const routeItems = routed.flatMap(({ query, legs }) => {
    let cursor = routeStart;
    return legs.map((leg) => {
      const startTime = clock(cursor);
      cursor += leg.durationMin;
      const endTime = clock(cursor);
      return {
        kind: "transport",
        day: query.day,
        startTime,
        endTime,
        location: `${query.from} → ${query.to}`,
        detail: `${leg.mode} from ${query.from} to ${query.to}; ${leg.durationMin} minutes${leg.note ? `; ${leg.note}` : ""}.`,
        estCost: leg.priceUsd,
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
  const total = items.reduce((sum, item) => sum + item.estCost, 0);
  return {
    agent: "transport",
    summary: `${items.length} transport option(s) for ${origin} ↔ ${destinations.join(" → ")} · USD ${total.toFixed(2)}`,
    items,
    assumptions: [
      `Origin defaults to Sydney unless long-term preference "transport.origin" is set; current origin: ${origin}.`,
      "Injected booking and maps results are treated as estimates, not reservations or live availability.",
      ...(budgetRevision ? ["Budget revision selected the lowest returned flight fare."] : []),
      ...(scheduleRevision ? ["Schedule revision moved routed legs to an early departure."] : []),
    ],
    conflictsWith: [],
  };
}

export const transportAgent: Agent = {
  name: "transport",
  label: "Getting around",
  run: (brief, ctx) => planTransport(brief, ctx),
  async revise(brief, ctx, request: RevisionRequest) {
    if (request.tripId !== brief.tripId || request.targetAgent !== "transport") {
      throw new Error("Transport revision must target this trip and agent.");
    }
    return planTransport(brief, ctx, request);
  },
};
