import {
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type Place,
  type RevisionRequest,
  type Specialist,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { dateForDay, planningDays, routeProblem } from "../transport/validation";
import { avoidBlockedWindows } from "./revision";

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
function fallbackDraft(brief: TripBrief, days: number, places: Place[]): ItineraryDraft {
  const candidates = places; // Empty evidence is handled before reaching this fallback.
  const dailyEstimate =
    Math.floor(((brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE) / days) * 100) / 100;
  return {
    summary: `${days}-day plan for ${brief.destination} with one grounded activity per day`,
    activities: Array.from({ length: days }, (_, index) => {
      const place = candidates[index % candidates.length]!;
      return {
        day: index + 1,
        startTime: "13:00",
        endTime: "16:00",
        location: place.name,
        detail: `${place.name} (${place.category}) is a suggested stop; confirm timing and suitability before visiting.`,
        estCost: Math.min(30 * brief.groupSize, dailyEstimate),
      };
    }),
    assumptions: [
      "Opening hours and live availability must be confirmed before plans are finalised.",
      "One anchored activity per day leaves room for meals, transfers and human changes.",
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
        systemPrompt:
          "You are the itinerary specialist. Always call read_itinerary_evidence before drafting. Use only its facts and candidate place names. Cover every trip day with 1-3 non-overlapping activities using 24-hour HH:mm times, leave 150 minutes between different locations, and keep activity cost within 40% of the total trip budget. Never claim live hours, availability, safety, visa or weather facts. Address a supplied revision exactly. Return the requested structured itinerary draft.\n\nEach activity location must be a candidate's name copied character for character. Do not append its category, rating or district, and do not reword it: an activity whose location is not an exact candidate name is discarded and the whole draft is thrown away.",
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

async function travelConflicts(
  draft: ItineraryDraft,
  ctx: AgentContext,
  brief: TripBrief,
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
      let legs;
      try {
        legs = await ctx.tools.maps.route({
          from: previous.location,
          to: current.location,
          date: dateForDay(brief.dates[0], day),
        });
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
      const required = Math.ceil(legs.reduce((sum, leg) => sum + leg.durationMin, 0)) + 15;
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
  const readPlaces = async (category: string) => {
    try {
      const found = await ctx.tools.maps.places({ near: brief.destination, category });
      return found.filter(
        (place) => typeof place.name === "string" && place.name.trim().length > 0,
      );
    } catch {
      ctx.signal?.throwIfAborted();
      evidenceIssues.push(
        `Place provider unavailable for ${category}; using only remaining evidence.`,
      );
      return [];
    }
  };
  const [sights, neighborhoods, preferences] = await Promise.all([
    readPlaces("sight"),
    readPlaces("neighborhood"),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const places = [
    ...new Map(
      [...sights, ...neighborhoods].map((place) => [place.name.trim().toLowerCase(), place]),
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
      draft = fallbackDraft(brief, days, places);
    }
  } else {
    draft = fallbackDraft(brief, days, places);
  }
  let adjusted = avoidBlockedWindows(draft, revision);
  draft = adjusted.draft;
  let conflicts = [...adjusted.conflicts, ...(await travelConflicts(draft, ctx, brief))];
  if (revision && conflicts.length) {
    // A revision must not preserve newly discovered geography conflicts; use a
    // conservative fallback and re-check it before returning.
    usedFallback = true;
    draft = fallbackDraft(brief, days, places);
    adjusted = avoidBlockedWindows(draft, revision);
    draft = adjusted.draft;
    conflicts = [...adjusted.conflicts, ...(await travelConflicts(draft, ctx, brief))];
  }
  return {
    agent: "itinerary",
    summary: draft.summary,
    items: draft.activities.map((activity) => ({ kind: "activity", ...activity })),
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
