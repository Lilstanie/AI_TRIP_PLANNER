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
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays, routeProblem } from "../transport/validation";
import { cities, cityForDay } from "../transport/legs";
import { avoidBlockedWindows } from "./revision";
import { mockEnabled } from "@trip/tools";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";

// The itinerary schema and guardrails constrain model output before it reaches
// the shared proposal format or the route-conflict checker.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MODEL_ACTIVITY_BUDGET_SHARE = 0.4;

const ItineraryActivity = z.object({
  day: z.number().int().positive(),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
  location: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  estCost: z.number().nonnegative(),
});

const ItineraryDraft = z.object({
  summary: z.string().trim().min(1),
  activities: z.array(ItineraryActivity).min(1),
  assumptions: z.array(z.string().trim().min(1)),
});

/** Structured day-plan content before conversion to AgentProposal items. */
export type ItineraryDraft = z.infer<typeof ItineraryDraft>;

/** Injectable planning seam used by tests and alternate model providers. */
export interface ItineraryGenerator {
  generate(input: {
    brief: TripBrief;
    days: number;
    places: Place[];
    preferences: UserPreference[];
    revision?: RevisionRequest;
  }): Promise<ItineraryDraft>;
}

/** Configuration for selecting an injected generator or deterministic mode. */
export interface ItineraryAgentOptions {
  /** Pass false to force the deterministic planner in tests or offline runs. */
  generator?: ItineraryGenerator | false;
}

/** Convert an HH:mm value to minutes so schedules can be compared numerically. */
function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

/** Enforce grounding, complete day coverage, budget and non-overlap invariants. */
function validateDraft(
  draft: ItineraryDraft,
  brief: TripBrief,
  days: number,
  places: Place[],
): ItineraryDraft {
  const parsed = ItineraryDraft.parse(draft);
  const candidates = new Set(places.map((place) => place.name.trim().toLocaleLowerCase()));
  const representedDays = new Set<number>();
  let total = 0;
  for (const activity of parsed.activities) {
    if (!candidates.has(activity.location.trim().toLocaleLowerCase())) {
      throw new Error(`Itinerary returned an ungrounded location: ${activity.location}`);
    }
    if (activity.day > days) throw new Error(`Itinerary day ${activity.day} exceeds trip length.`);
    if (minutes(activity.endTime) <= minutes(activity.startTime)) {
      throw new Error(`Itinerary activity on day ${activity.day} must end after it starts.`);
    }
    representedDays.add(activity.day);
    total += activity.estCost;
  }
  if (representedDays.size !== days) throw new Error("Itinerary must include every trip day.");
  if (total > brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE) {
    throw new Error("Itinerary activity estimate exceeds its planning guardrail.");
  }
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

/** Create one low-risk activity per day when a model is unavailable or invalid. */
/**
 * A morning and an afternoon stop, with the middle of the day left open.
 *
 * The gap is deliberately wide enough for a meal and the journey between the
 * two, which the route check then verifies against the real travel time rather
 * than assuming.
 */
const DAY_SLOTS = [
  { startTime: "09:30", endTime: "12:00" },
  { startTime: "14:00", endTime: "16:30" },
] as const;

/** A day with only one grounded stop keeps the afternoon anchor it always had. */
const SINGLE_SLOT = { startTime: "13:00", endTime: "16:00" } as const;

function fallbackDraft(
  brief: TripBrief,
  days: number,
  places: Place[],
  placesByCity?: ReadonlyMap<string, readonly Place[]>,
): ItineraryDraft {
  const candidates = places; // Empty evidence is handled before reaching this fallback.
  // Each day draws on the city it is spent in, so a day's stops are places a
  // traveller can actually move between. The day-to-city split is the one the
  // journey legs use, so the two plans describe the same trip.
  const cityNames = cities(brief.destination);
  const dayCity = cityForDay(cityNames, days);
  const forDay = (day: number): readonly Place[] => {
    const inCity = placesByCity?.get(dayCity[day - 1] ?? cityNames[0]!) ?? [];
    return inCity.length ? inCity : candidates;
  };
  // Two stops a day, but never more stops than the thinnest day has places for.
  const scarcest = Math.min(...Array.from({ length: days }, (_, day) => forDay(day + 1).length));
  const perDay = Math.min(DAY_SLOTS.length, Math.max(1, Math.floor(scarcest / 2) || 1));
  const dailyEstimate =
    Math.floor(((brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE) / days) * 100) / 100;
  // The day's allowance is split across its stops rather than spent on each:
  // the cap is what a day of activities may cost, so two stops must share it
  // or adding a second stop would silently double the itinerary's budget.
  const perActivity =
    Math.floor((Math.min(30 * brief.groupSize, dailyEstimate) / perDay) * 100) / 100;
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
        estCost: perActivity,
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

/** Build a model generator whose evidence tool exposes only validated inputs. */
function createDeepSeekGenerator(): ItineraryGenerator | undefined {
  const model = createRoutedChatModel("itinerary");
  if (!model) return undefined;
  return {
    async generate(input) {
      // The model must call this tool before drafting so it cannot invent places
      // or silently ignore a revision request.
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
        systemPrompt: `You are the itinerary specialist. Always call read_itinerary_evidence before drafting. Use only its facts and candidate place names. Cover every trip day with 1-3 non-overlapping activities using 24-hour HH:mm times, leave 150 minutes between different locations, and keep activity cost within ${MODEL_ACTIVITY_BUDGET_SHARE * 100}% of the total trip budget. Never claim live hours, availability, safety, visa or weather facts. Address a supplied revision exactly. Return the requested structured itinerary draft.\n\nEach activity location must be a candidate's name copied character for character. Do not append its category, rating or district, and do not reword it: an activity whose location is not an exact candidate name is discarded and the whole draft is thrown away.\n\n${TRAVELLER_PREFERENCES_RULE}`,
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
            }),
          },
        ],
      });
      return readStructuredResponse("itinerary", ItineraryDraft, result);
    },
  };
}

/** Keyed by the activity a connection arrives at: `day|startTime|location`. */
export type Connections = Map<string, ArriveBy>;

const connectionKey = (activity: { day: number; startTime: string; location: string }) =>
  `${activity.day}|${activity.startTime}|${activity.location}`;

/**
 * The mode and service a hop actually uses, from the richer comparison when the
 * adapter offers one. `route()` reports everything as a generic "transit", so
 * without this the itinerary could say how long a hop takes but not how it is
 * made — which is the part a traveller standing on a street needs.
 */
function describeHop(legs: RouteLeg[], options: RouteOption[]): { mode: TravelMode; line?: string } {
  const best = options.find((option) => option.mode !== "drive") ?? options[0];
  // Only the service designation: the note reads "via tram L2", and the mode
  // is already named beside it, so capturing both renders "Tram tram L2".
  const line = best?.note?.match(/via [a-z]+ ([\w-]+)/i)?.[1];
  if (best) return { mode: best.mode, ...(line ? { line } : {}) };
  const leg = legs[0];
  return { mode: leg?.mode ?? "transit" };
}

/**
 * Where each candidate place actually is, keyed by its name.
 *
 * A drafted activity's `location` is a candidate's name copied character for
 * character — `validateDraft` throws away any draft where it is not — so the
 * name is an exact key back to the place the provider returned, coordinates
 * included. Normalised the same way `validateDraft` compares them, or a name
 * differing only in case would silently lose its position.
 */
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
  // Check map travel time between consecutive activities on each day. These
  // conflicts are reported to the orchestrator rather than silently shifting times.
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
      // One query for both lookups: they describe the same hop, and letting
      // them drift apart would compare one journey against another's timing.
      // The coordinates are what stop a bare place name being resolved against
      // the whole world — two stops in the same city came back unroutable
      // because the geocoder found a namesake on another continent.
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
      // The lookup already happened for the conflict check; keeping its answer
      // is what turns a silent gap between two activities into a connection.
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
): Promise<AgentProposal> {
  // Validate the brief and gather map/preferences evidence in parallel before
  // selecting the model or deterministic planner.
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = planningDays(brief.dates);
  const evidenceIssues: string[] = [];
  const readPlaces = async (category: string, near: string) => {
    try {
      const found = await ctx.tools.maps.places({ near, category });
      return found.filter(
        (place) => typeof place.name === "string" && place.name.trim().length > 0,
      );
    } catch {
      ctx.signal?.throwIfAborted();
      evidenceIssues.push(
        `Place provider unavailable for ${category} in ${near}; using only remaining evidence.`,
      );
      return [];
    }
  };
  // A multi-city brief is searched city by city. Asking Google for places
  // "near Sydney & Wollongong" returns a mix of both with nothing saying
  // which is which, and the day plan then put a Wollongong lookout and the
  // Sydney CBD in the same afternoon, two hours apart.
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
              [...sights, ...neighborhoods].map((place) => [place.name.trim().toLowerCase(), place]),
            ).values(),
          ],
        ] as const;
      }),
    ),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const placesByCity = new Map(byCity);
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
    try {
      draft = validateDraft(
        await generator.generate({ brief, days, places, preferences, revision }),
        brief,
        days,
        places,
      );
    } catch (error) {
      ctx.signal?.throwIfAborted();
      usedFallback = true;
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(`[itinerary] Model draft failed validation; using a safe local plan: ${reason}`);
      draft = fallbackDraft(brief, days, places, placesByCity);
    }
  } else {
    draft = fallbackDraft(brief, days, places, placesByCity);
  }
  let adjusted = avoidBlockedWindows(draft, revision);
  draft = adjusted.draft;
  const coordinates = placeCoordinates(places);
  let connections: Connections = new Map();
  let conflicts = [
    ...adjusted.conflicts,
    ...(await travelConflicts(draft, ctx, brief, connections, coordinates)),
  ];
  if (revision && conflicts.length) {
    // A revision must not preserve newly discovered geography conflicts; use a
    // conservative fallback and re-check it before returning.
    usedFallback = true;
    draft = fallbackDraft(brief, days, places, placesByCity);
    adjusted = avoidBlockedWindows(draft, revision);
    draft = adjusted.draft;
    // The fallback is a different day plan, so its connections are different too.
    connections = new Map();
    conflicts = [
      ...adjusted.conflicts,
      ...(await travelConflicts(draft, ctx, brief, connections, coordinates)),
    ];
  }
  return {
    agent: "itinerary",
    summary: draft.summary,
    items: draft.activities.map((activity) => {
      const arriveBy = connections.get(connectionKey(activity));
      return { kind: "activity", ...activity, ...(arriveBy ? { arriveBy } : {}) };
    }),
    assumptions: [
      ...draft.assumptions,
      ...evidenceIssues,
      "Different-place connections require route time plus a 15-minute arrival buffer. Opening hours remain unverified.",
      ...(usedFallback
        ? [
            "Planner source: deterministic fallback; activity costs are planning allowances, not verified admission fares.",
          ]
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
          freshness: "The model draft was unavailable or invalid; a deterministic itinerary was used from the gathered place evidence.",
        }
      : {
          kind: !mockEnabled() ? "estimated" : "mock",
          label: "Maps evidence and AI plan",
          freshness:
            !mockEnabled()
              ? "Place and route details are provider estimates; opening hours and availability remain unverified."
              : "Place and route details come from deterministic mock fixtures; not live verified.",
        },
  };
}

/** Factory keeps the planner injectable while exposing the Specialist API. */
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
      return planItinerary(request.brief, request.context, options, request.revision);
    },
  };
}

// Default instance used by the shared agent registry.
export const itineraryAgent = createItineraryAgent();
