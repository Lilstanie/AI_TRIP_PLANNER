import {
  TripBrief as TripBriefSchema,
  type Agent,
  type AgentContext,
  type AgentProposal,
  type Place,
  type RevisionRequest,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { z } from "zod/v4";
import { createRoutedStructuredInvoker } from "../models";

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

export type ItineraryDraft = z.infer<typeof ItineraryDraft>;

export interface ItineraryGenerator {
  generate(input: {
    brief: TripBrief;
    days: number;
    places: Place[];
    preferences: UserPreference[];
    revision?: RevisionRequest;
  }): Promise<ItineraryDraft>;
}

export interface ItineraryAgentOptions {
  /** Pass false to force the deterministic planner in tests or offline runs. */
  generator?: ItineraryGenerator | false;
}

function daySpan([start, end]: [string, string]): number {
  const parse = (value: string) => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== value
    ) {
      throw new Error(`Itinerary requires a valid YYYY-MM-DD date: ${value}`);
    }
    return timestamp;
  };
  const days = Math.round((parse(end) - parse(start)) / 86_400_000);
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Itinerary requires ordered dates.");
  return days;
}

function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

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

function fallbackDraft(brief: TripBrief, days: number, places: Place[]): ItineraryDraft {
  const candidates = places.length
    ? places
    : [{ name: `Central ${brief.destination}`, category: "orientation" }];
  const dailyEstimate =
    Math.floor(((brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE) / days) * 100) / 100;
  return {
    summary: `${days}-day paced itinerary for ${brief.destination}`,
    activities: Array.from({ length: days }, (_, index) => {
      const place = candidates[index % candidates.length]!;
      return {
        day: index + 1,
        startTime: "13:00",
        endTime: "16:00",
        location: place.name,
        detail: `Explore ${place.name} (${place.category}) at a relaxed pace.`,
        estCost: Math.min(30 * brief.groupSize, dailyEstimate),
      };
    }),
    assumptions: [
      "Deterministic fallback used: opening hours and live availability must be confirmed.",
      "One anchored activity per day leaves room for meals, transfers and human changes.",
    ],
  };
}

function createDeepSeekGenerator(): ItineraryGenerator | undefined {
  const structured = createRoutedStructuredInvoker(
    "itinerary",
    ItineraryDraft,
    "TripItineraryDraft",
  );
  if (!structured) return undefined;
  return {
    async generate(input) {
      return structured(
        `Create a practical trip itinerary using only the supplied facts. Return every trip day from 1 through ${input.days}. Each day needs 1-3 non-overlapping activities with 24-hour HH:mm times. Leave at least 150 minutes between activities at different locations so transport can be feasible. Keep total activity cost at or below ${(input.brief.budgetTotal * MODEL_ACTIVITY_BUDGET_SHARE).toFixed(2)} USD for the whole group. Do not claim live opening hours, availability, safety, visa or weather facts. Treat candidate places as unverified suggestions. If a revision is present, address it exactly.\n\nTrip brief:\n${JSON.stringify(input.brief)}\n\nConfirmed preferences:\n${JSON.stringify(input.preferences)}\n\nCandidate places:\n${JSON.stringify(input.places)}\n\nRevision:\n${JSON.stringify(input.revision ?? null)}`,
      );
    },
  };
}

async function travelConflicts(draft: ItineraryDraft, ctx: AgentContext): Promise<string[]> {
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
      const legs = await ctx.tools.maps.route({
        from: previous.location,
        to: current.location,
      });
      const required = legs.reduce((sum, leg) => sum + leg.durationMin, 0);
      const available = minutes(current.startTime) - minutes(previous.endTime);
      if (required > available) {
        conflicts.push(
          `geography conflict on day ${day}: ${previous.location} to ${current.location} needs ${required} minutes but only ${available} are available`,
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
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = daySpan(brief.dates);
  const [sights, neighborhoods, preferences] = await Promise.all([
    ctx.tools.maps.places({ near: brief.destination, category: "sight" }),
    ctx.tools.maps.places({ near: brief.destination, category: "neighborhood" }),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const places = [...sights, ...neighborhoods];
  const generator =
    options.generator === false ? undefined : (options.generator ?? createDeepSeekGenerator());
  let draft: ItineraryDraft;
  let source: "DeepSeek/LangChain" | "deterministic fallback" = "deterministic fallback";
  if (generator) {
    try {
      draft = validateDraft(
        await generator.generate({ brief, days, places, preferences, revision }),
        brief,
        days,
        places,
      );
      source = "DeepSeek/LangChain";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(
        `[itinerary] Model draft failed validation; using deterministic fallback: ${reason}`,
      );
      draft = fallbackDraft(brief, days, places);
    }
  } else {
    draft = fallbackDraft(brief, days, places);
  }
  let conflicts = await travelConflicts(draft, ctx);
  if (revision && conflicts.length) {
    draft = fallbackDraft(brief, days, places);
    conflicts = await travelConflicts(draft, ctx);
    source = "deterministic fallback";
  }
  return {
    agent: "itinerary",
    summary: draft.summary,
    items: draft.activities.map((activity) => ({ kind: "activity", ...activity })),
    assumptions: [
      `Planner source: ${source}.`,
      ...draft.assumptions,
      ...(revision ? [`Revision requested: ${revision.reason}.`] : []),
    ],
    conflictsWith: conflicts,
  };
}

export function createItineraryAgent(options: ItineraryAgentOptions = {}): Agent {
  return {
    name: "itinerary",
    label: "Day plan",
    run: (brief, ctx) => planItinerary(brief, ctx, options),
    async revise(brief, ctx, request) {
      if (request.tripId !== brief.tripId || request.targetAgent !== "itinerary") {
        throw new Error("Itinerary revision must target this trip and agent.");
      }
      return planItinerary(brief, ctx, options, request);
    },
  };
}

export const itineraryAgent = createItineraryAgent();
