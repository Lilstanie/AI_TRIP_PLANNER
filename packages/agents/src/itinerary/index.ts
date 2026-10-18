import {
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type ArriveBy,
  type GeoPoint,
  type Place,
  type RouteLeg,
  type RouteOption,
  type RouteQuery,
  type TravelMode,
  type RevisionRequest,
  type Specialist,
  type TripBrief,
  type UserPreference,
  type BudgetAllocation,
  type PlanningBoard,
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays, routeProblem } from "../transport/validation";
import { cities, cityForDay, scheduledHops } from "../transport/legs";
import { avoidBlockedWindows } from "./revision";
import { mockEnabled } from "@trip/tools";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MODEL_ACTIVITY_BUDGET_SHARE = 0.4;

const ItineraryActivity = z.object({
  day: z.number().int().positive(),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
  location: z.string().trim().min(1),
  detail: z.string().trim().min(1),

  estCost: z.number().nonnegative().optional(),
});

const ItineraryDraft = z.object({
  summary: z.string().trim().min(1),
  activities: z.array(ItineraryActivity).min(1),
  assumptions: z.array(z.string().trim().min(1)),
});

export type ItineraryDraft = z.infer<typeof ItineraryDraft>;

export interface ItineraryGenerator {
  generate(input: {
    brief: TripBrief;
    days: number;
    places: Place[];
    preferences: UserPreference[];
    revision?: RevisionRequest;

    feedback?: string;

    activityBudget: number;

    otherSections?: { agent: string; summary: string; items: string[] }[];

    dayCities?: { day: number; cities: string[] }[];
    candidatesByCity?: Record<string, string[]>;

    previous?: { summary: string; activities: string[] };
  }): Promise<ItineraryDraft>;
}

export interface ItineraryAgentOptions {
  generator?: ItineraryGenerator | false;
}

export function citiesByDay(
  destination: string,
  days: number,
  transport?: AgentProposal,
): string[][] {
  const names = cities(destination);
  const byDay = cityForDay(names, days).map((city) => [city]);
  const hops = scheduledHops(destination, transport);
  if (!hops.length) return byDay;
  let current = names[0]!;
  return byDay.map((_, index) => {
    const day = index + 1;
    const hop = hops.find((candidate) => candidate.day === day);
    if (hop) {
      current = hop.to;
      return [hop.from, hop.to];
    }
    return [current];
  });
}

function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

function validateDraft(
  draft: ItineraryDraft,
  days: number,
  places: Place[],
  dayCities?: string[][],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
): ItineraryDraft {
  const parsed = ItineraryDraft.parse(draft);

  if (dayCities && placesByCity && placesByCity.size > 1) {
    const cityOf = new Map<string, string[]>();
    for (const [city, found] of placesByCity)
      for (const place of found) {
        const key = place.name.trim().toLocaleLowerCase();
        cityOf.set(key, [...(cityOf.get(key) ?? []), city]);
      }
    for (const activity of parsed.activities) {
      const allowed = dayCities[activity.day - 1] ?? [];
      const found = cityOf.get(activity.location.trim().toLocaleLowerCase()) ?? [];
      if (found.length && !found.some((city) => allowed.includes(city))) {
        throw new Error(
          `Day ${activity.day} is spent in ${allowed.join(" and ")}, but ${activity.location} is in ${found.join(" and ")}. Use only that day's city's candidates.`,
        );
      }
    }
  }
  const candidates = new Set(places.map((place) => place.name.trim().toLocaleLowerCase()));
  const representedDays = new Set<number>();
  for (const activity of parsed.activities) {
    if (!candidates.has(activity.location.trim().toLocaleLowerCase())) {
      throw new Error(`Itinerary returned an ungrounded location: ${activity.location}`);
    }
    if (activity.day > days) throw new Error(`Itinerary day ${activity.day} exceeds trip length.`);
    if (minutes(activity.endTime) <= minutes(activity.startTime)) {
      throw new Error(`Itinerary activity on day ${activity.day} must end after it starts.`);
    }
    representedDays.add(activity.day);
  }

  const seen = new Set<string>();
  for (const activity of parsed.activities) {
    const key = `${activity.day}|${activity.location.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) {
      throw new Error(
        `Itinerary repeats ${activity.location} on day ${activity.day}; make it one longer activity or pick another place.`,
      );
    }
    seen.add(key);
  }
  if (representedDays.size !== days) throw new Error("Itinerary must include every trip day.");
  for (let day = 1; day <= days; day += 1) {
    const scheduled = parsed.activities
      .filter((activity) => activity.day === day)
      .sort((left, right) => minutes(left.startTime) - minutes(right.startTime));
    for (let index = 1; index < scheduled.length; index += 1) {
      if (minutes(scheduled[index]!.startTime) < minutes(scheduled[index - 1]!.endTime)) {
        throw new Error(`Itinerary activities overlap on day ${day}.`);
      }
    }
  }
  return parsed;
}

function isGenericPlace(place: Place, near: string, destination: string): boolean {
  const name = place.name.trim().toLocaleLowerCase();
  return [near, destination, place.category, `${place.category}s`, "neighborhood", "neighbourhood"]
    .map((value) => value.trim().toLocaleLowerCase())
    .includes(name);
}

const DAY_SLOTS = [
  { startTime: "09:30", endTime: "12:00" },
  { startTime: "14:00", endTime: "16:30" },
] as const;

const SINGLE_SLOT = { startTime: "13:00", endTime: "16:00" } as const;

function fallbackDraft(
  brief: TripBrief,
  days: number,
  places: Place[],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
  dayCities?: string[][],
): ItineraryDraft {
  const candidates = places;

  const cityNames = cities(brief.destination);

  const dayCity = dayCities?.map((cities) => cities.at(-1)!) ?? cityForDay(cityNames, days);
  const forDay = (day: number): readonly Place[] => {
    const inCity = placesByCity?.get(dayCity[day - 1] ?? cityNames[0]!) ?? [];
    return inCity.length ? inCity : candidates;
  };

  const scarcest = Math.min(...Array.from({ length: days }, (_, day) => forDay(day + 1).length));
  const perDay = Math.min(DAY_SLOTS.length, Math.max(1, Math.floor(scarcest / 2) || 1));

  const slots = perDay === 1 ? [SINGLE_SLOT] : DAY_SLOTS.slice(0, perDay);
  const activities = Array.from({ length: days }, (_, day) =>
    Array.from({ length: perDay }, (_, slot) => {
      const cityPlaces = forDay(day + 1);
      const place = cityPlaces[(day * perDay + slot) % cityPlaces.length]!;
      return {
        day: day + 1,
        ...slots[slot]!,
        location: place.name,
        detail: `${place.name} (${place.category}) is a suggested stop; confirm timing and suitability before visiting.`,
      };
    }),
  ).flat();
  return {
    summary: `${days}-day plan for ${brief.destination} with ${perDay === 1 ? "one grounded activity" : `${perDay} grounded activities`} per day`,
    activities,
    assumptions: [
      "Opening hours and live availability must be confirmed before plans are finalised.",
      perDay === 1
        ? "Only enough grounded places for one anchored activity a day; the rest of each day is left open."
        : "Two anchored stops a day, with the middle of the day left for a meal and the journey between them.",
    ],
  };
}

function createDeepSeekGenerator(): ItineraryGenerator | undefined {
  const model = createRoutedChatModel("itinerary");
  if (!model) return undefined;
  return {
    async generate(input) {
      const evidence = tool(async () => input, {
        name: "read_itinerary_evidence",
        description:
          "Read the validated trip brief, trip length, grounded map candidates, confirmed preferences and any revision request.",
        schema: z.object({}),
      });
      const specialist = createAgent({
        name: "itinerary_specialist",
        model,
        tools: [evidence],
        systemPrompt: `You are the itinerary specialist. Always call read_itinerary_evidence before drafting. Use only its facts and candidate place names. Cover every trip day with 1-3 non-overlapping activities using 24-hour HH:mm times, leave 150 minutes between different locations, and treat activityBudget, what flights and the stay left for activities, as a guide to how many paid attractions to include. Do not state activity prices: no evidence has them. When dayCities is given, every activity on a day must be a candidate from one of that day's cities in candidatesByCity; a day with two cities is travel day. When otherSections names where the traveller sleeps, build each day around that stay and keep long trips away from it rare. On a revision, start from previous and change only what the revision asks. Never claim live hours, availability, safety, visa or weather facts. Address a supplied revision exactly. Return the requested structured itinerary draft.\n\nEach activity location must be a candidate's name copied character for character. Do not append its category, rating or district, and do not reword it: an activity whose location is not an exact candidate name is discarded and the whole draft is thrown away.\n\n${TRAVELLER_PREFERENCES_RULE}`,
        responseFormat: ItineraryDraft,
      });
      const result = await specialist.invoke({
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              task: "Draft the itinerary from the validated evidence available through your tool.",
              tripId: input.brief.tripId,
              revision: input.revision?.reason,
              ...(input.feedback
                ? { previousDraftRejected: `${input.feedback} Fix this and return a new draft.` }
                : {}),
            }),
          },
        ],
      });
      return readStructuredResponse("itinerary", ItineraryDraft, result);
    },
  };
}

export type Connections = Map<string, ArriveBy>;

const connectionKey = (activity: { day: number; startTime: string; location: string }) =>
  `${activity.day}|${activity.startTime}|${activity.location}`;

function describeHop(
  legs: RouteLeg[],
  options: RouteOption[],
): { mode: TravelMode; line?: string } {
  const best = options.find((option) => option.mode !== "drive") ?? options[0];

  const line = best?.note?.match(/via [a-z]+ ([\w-]+)/i)?.[1];
  if (best) return { mode: best.mode, ...(line ? { line } : {}) };
  const leg = legs[0];
  return { mode: leg?.mode ?? "transit" };
}

function placeCoordinates(places: Place[]): ReadonlyMap<string, GeoPoint> {
  return new Map(
    places.flatMap((place) =>
      place.location ? [[place.name.trim().toLocaleLowerCase(), place.location] as const] : [],
    ),
  );
}

async function travelConflicts(
  draft: ItineraryDraft,
  ctx: AgentContext,
  brief: TripBrief,
  connections: Connections,
  coordinates: ReadonlyMap<string, GeoPoint>,
): Promise<string[]> {
  const conflicts: string[] = [];
  const days = new Set(draft.activities.map((activity) => activity.day));
  for (const day of days) {
    const activities = draft.activities
      .filter((activity) => activity.day === day)
      .sort((left, right) => minutes(left.startTime) - minutes(right.startTime));
    for (let index = 1; index < activities.length; index += 1) {
      const previous = activities[index - 1]!;
      const current = activities[index]!;
      if (previous.location === current.location) continue;
      ctx.signal?.throwIfAborted();

      const at = (name: string) => coordinates.get(name.trim().toLocaleLowerCase());
      const fromLocation = at(previous.location);
      const toLocation = at(current.location);
      const query: RouteQuery = {
        from: previous.location,
        to: current.location,
        date: dateForDay(brief.dates[0], day),
        localTime: previous.endTime,
        ...(fromLocation ? { fromLocation } : {}),
        ...(toLocation ? { toLocation } : {}),
      };
      let legs;
      try {
        legs = await ctx.tools.maps.route(query);
      } catch {
        ctx.signal?.throwIfAborted();
        conflicts.push(
          `geography conflict on day ${day}: route provider failed; connection unverified`,
        );
        continue;
      }
      ctx.signal?.throwIfAborted();
      const problem = routeProblem(legs);
      if (problem) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location}: ${problem}`,
        );
        continue;
      }
      const durationMin = Math.ceil(legs.reduce((sum, leg) => sum + leg.durationMin, 0));

      const options = ctx.tools.maps.routeOptions
        ? await ctx.tools.maps.routeOptions(query).catch(() => [] as RouteOption[])
        : [];
      if (durationMin > 0) {
        const { mode, line } = describeHop(legs, options);
        connections.set(connectionKey(current), {
          mode,
          durationMin,
          ...(line ? { line } : {}),
          from: previous.location,
        });
      }
      const required = durationMin + 15;
      const available = minutes(current.startTime) - minutes(previous.endTime);
      if (required > available) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location} needs ${required} minutes including a 15-minute buffer but only ${available} are available`,
        );
      }
    }
  }
  return conflicts;
}

async function planItinerary(
  briefInput: TripBrief,
  ctx: AgentContext,
  options: ItineraryAgentOptions,
  revision?: RevisionRequest,
  extras: { allocation?: BudgetAllocation; board?: PlanningBoard; previous?: AgentProposal } = {},
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = planningDays(brief.dates);

  const activityBudget =
    extras.allocation?.budget ?? brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE;
  const otherSections = (extras.board?.proposals ?? [])
    .filter((proposal) => proposal.agent === "accommodation" || proposal.agent === "transport")
    .map((proposal) => ({
      agent: proposal.agent,
      summary: proposal.summary,
      items: proposal.items.map((item) => `day ${item.day ?? "?"}: ${item.detail}`),
    }));
  const evidenceIssues: string[] = [];
  const readPlaces = async (category: string, near: string) => {
    try {
      const found = await ctx.tools.maps.places({ near, category });
      return found.filter(
        (place) =>
          typeof place.name === "string" &&
          place.name.trim().length > 0 &&
          !isGenericPlace(place, near, brief.destination),
      );
    } catch {
      ctx.signal?.throwIfAborted();
      evidenceIssues.push(
        `Place provider unavailable for ${category} in ${near}; using only remaining evidence.`,
      );
      return [];
    }
  };

  const cityNames = cities(brief.destination);
  const [byCity, preferences] = await Promise.all([
    Promise.all(
      cityNames.map(async (city) => {
        const [sights, neighborhoods] = await Promise.all([
          readPlaces("sight", city),
          readPlaces("neighborhood", city),
        ]);
        return [
          city,
          [
            ...new Map(
              [...sights, ...neighborhoods].map((place) => [
                place.name.trim().toLowerCase(),
                place,
              ]),
            ).values(),
          ],
        ] as const;
      }),
    ),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const placesByCity = new Map(byCity);
  const dayCities = citiesByDay(
    brief.destination,
    days,
    extras.board?.proposals.find((proposal) => proposal.agent === "transport"),
  );
  const places = [
    ...new Map(
      [...placesByCity.values()].flat().map((place) => [place.name.trim().toLowerCase(), place]),
    ).values(),
  ];
  if (!places.length) {
    return {
      agent: "itinerary",
      summary: "Itinerary needs verified place data",
      items: [],
      assumptions: [
        ...evidenceIssues,
        "No grounded places available; no attraction, opening time or admission price has been invented.",
      ],
      conflictsWith: [
        "geography conflict: no grounded places available; itinerary requires new evidence",
      ],
      source: {
        kind: "unavailable",
        label: "Maps provider",
        freshness: "No grounded place data was available, so no activities were invented.",
      },
    };
  }
  const generator =
    options.generator === false ? undefined : (options.generator ?? createDeepSeekGenerator());
  let draft: ItineraryDraft;
  let usedFallback = !generator;
  if (generator) {
    let feedback: string | undefined;
    let accepted: ItineraryDraft | undefined;
    for (let attempt = 0; attempt < 2 && !accepted; attempt += 1) {
      try {
        accepted = validateDraft(
          await generator.generate({
            brief,
            days,
            places,
            preferences,
            revision,
            activityBudget,
            ...(placesByCity.size > 1
              ? {
                  dayCities: dayCities.map((cities, index) => ({ day: index + 1, cities })),
                  candidatesByCity: Object.fromEntries(
                    [...placesByCity].map(([city, found]) => [
                      city,
                      found.map((place) => place.name),
                    ]),
                  ),
                }
              : {}),
            ...(otherSections.length ? { otherSections } : {}),
            ...(extras.previous
              ? {
                  previous: {
                    summary: extras.previous.summary,
                    activities: extras.previous.items.map(
                      (item) =>
                        `day ${item.day} ${item.startTime}-${item.endTime} ${item.location}`,
                    ),
                  },
                }
              : {}),
            ...(feedback ? { feedback } : {}),
          }),
          days,
          places,
          dayCities,
          placesByCity,
        );
      } catch (error) {
        ctx.signal?.throwIfAborted();
        feedback = error instanceof Error ? error.message : "unknown model error";
        console.warn(
          `[itinerary] Model draft failed validation (attempt ${attempt + 1}): ${feedback}`,
        );
      }
    }
    if (accepted) draft = accepted;
    else {
      usedFallback = true;
      draft = fallbackDraft(brief, days, places, placesByCity, dayCities);
    }
  } else {
    draft = fallbackDraft(brief, days, places, placesByCity, dayCities);
  }
  const adjusted = avoidBlockedWindows(draft, revision);
  draft = adjusted.draft;
  const coordinates = placeCoordinates(places);
  let connections: Connections = new Map();
  let conflicts = [
    ...adjusted.conflicts,
    ...(await travelConflicts(draft, ctx, brief, connections, coordinates)),
  ];
  if (revision && conflicts.length && !usedFallback) {
    const fallback = avoidBlockedWindows(
      fallbackDraft(brief, days, places, placesByCity, dayCities),
      revision,
    );

    const fallbackConnections: Connections = new Map();
    const fallbackConflicts = [
      ...fallback.conflicts,
      ...(await travelConflicts(fallback.draft, ctx, brief, fallbackConnections, coordinates)),
    ];
    if (fallbackConflicts.length < conflicts.length) {
      usedFallback = true;
      draft = fallback.draft;
      connections = fallbackConnections;
      conflicts = fallbackConflicts;
    }
  }
  return {
    agent: "itinerary",
    summary: draft.summary,

    items: draft.activities.map(({ estCost: _unpriced, ...activity }) => {
      const arriveBy = connections.get(connectionKey(activity));
      return { kind: "activity", ...activity, ...(arriveBy ? { arriveBy } : {}) };
    }),
    assumptions: [
      ...draft.assumptions,
      ...evidenceIssues,
      "Different-place connections require route time plus a 15-minute arrival buffer. Opening hours remain unverified.",
      `Activity prices unknown: no source publishes admission prices for these ${draft.activities.length} stops, so none is counted in the trip total.`,
      ...(placesByCity.size > 1
        ? [
            `Cities by day: ${dayCities.map((cities, index) => `day ${index + 1} ${cities.join(" → ")}`).join("; ")}.`,
          ]
        : []),
      ...(usedFallback
        ? ["Planner source: deterministic fallback from the gathered place evidence."]
        : []),
      ...(revision
        ? [
            `Revision requested: ${revision.reason}.`,
            "The orchestrator must recheck the full plan budget; no percentage saving is claimed without a previous proposal baseline.",
          ]
        : []),
    ],
    conflictsWith: conflicts,
    source: usedFallback
      ? {
          kind: "fallback",
          label: "Local fallback",
          freshness:
            "The model draft was unavailable or invalid; a deterministic itinerary was used from the gathered place evidence.",
        }
      : {
          kind: !mockEnabled() ? "estimated" : "mock",
          label: "Maps evidence and AI plan",
          freshness: !mockEnabled()
            ? "Place and route details are provider estimates; opening hours and availability remain unverified."
            : "Place and route details come from deterministic mock fixtures; not live verified.",
        },
  };
}

export function createItineraryAgent(options: ItineraryAgentOptions = {}): Specialist {
  return {
    name: "itinerary",
    label: "Day plan",
    supportsRevision: true,
    async invoke(request) {
      if (request.revision) {
        if (
          request.revision.tripId !== request.brief.tripId ||
          request.revision.targetAgent !== "itinerary"
        ) {
          throw new Error("Itinerary revision must target this trip and agent.");
        }
      }
      return planItinerary(request.brief, request.context, options, request.revision, {
        ...(request.allocation ? { allocation: request.allocation } : {}),
        ...(request.board ? { board: request.board } : {}),
        ...(request.previous ? { previous: request.previous } : {}),
      });
    },
  };
}

export const itineraryAgent = createItineraryAgent();
