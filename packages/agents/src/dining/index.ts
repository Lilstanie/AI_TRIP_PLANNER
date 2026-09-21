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
import { mockEnabled } from "@trip/tools";

// Dining has an explicit budget envelope: venue candidates are unpriced unless
// a caller separately confirms them, so only the envelope contributes cost.
const DAY_MS = 86_400_000;
const DINING_BUDGET_SHARE = 0.2;
// A judgement about what a person spends on meals in a day, so it is repriced with the
// base currency rather than just renamed. Was AUD 75.
const MAX_DAILY_PER_PERSON = 115;

const DiningPick = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
});

const DiningDraft = z.object({
  summary: z.string().trim().min(1).max(400),
  dailyBudgetPerPerson: z.number().nonnegative(),
  picks: z.array(DiningPick).max(5),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(6),
});

/** Structured model output before conversion to the shared AgentProposal. */
export type DiningDraft = z.infer<typeof DiningDraft>;

/** Injectable model seam used for tests and provider swaps. */
export interface DiningGenerator {
  generate(input: {
    brief: TripBrief;
    days: number;
    places: Place[];
    dietaryPreferences: UserPreference[];
    maxDailyPerPerson: number;
    revision?: RevisionRequest;
  }): Promise<DiningDraft>;
}

/** Configuration for selecting an injected generator or deterministic mode. */
export interface DiningAgentOptions {
  /** Pass false to force deterministic recommendations and budgeting. */
  generator?: DiningGenerator | false;
}

/** Normalize venue names for grounded comparisons. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function uniquePlaces(places: Place[]): Place[] {
  return places.filter(
    (place, index, all) =>
      all.findIndex((candidate) => normalize(candidate.name) === normalize(place.name)) === index,
  );
}

function canonicalPlaceName(name: string, places: Place[]): string {
  const match = places.find((place) => normalize(place.name) === normalize(name));
  return match?.name ?? name.trim();
}

function dedupeEntries<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Validate dates and return the number of planning days. */
function tripDays([start, end]: [string, string]): number {
  const parse = (value: string) => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== value
    ) {
      throw new Error(`Dining requires a valid YYYY-MM-DD date: ${value}`);
    }
    return timestamp;
  };
  const days = Math.round((parse(end) - parse(start)) / DAY_MS);
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Dining requires ordered dates.");
  return days;
}

/** Keep only preferences that can affect food choices or allergen handling. */
function dietaryPreferences(preferences: UserPreference[]): UserPreference[] {
  return preferences.filter((preference) =>
    /diet|food|meal|allerg|halal|kosher|vegetarian|vegan|plant[- ]based|gluten|lactose|celiac|shellfish|pescatarian/i.test(
      `${preference.key} ${preference.value}`,
    ),
  );
}

/** Identify revisions that should tighten the meal-budget ceiling. */
function isBudgetRevision(revision?: RevisionRequest): boolean {
  return Boolean(
    revision &&
    /budget|cost|cheaper|overrun|cut|reduce/i.test(
      [revision.reason, ...revision.constraints].join(" "),
    ),
  );
}

/** Compute the per-person ceiling shared with the model and validator. */
function budgetCeiling(brief: TripBrief, days: number, revision?: RevisionRequest): number {
  const normal = Math.min(
    MAX_DAILY_PER_PERSON,
    (brief.budgetTotal * DINING_BUDGET_SHARE) / (brief.groupSize * days),
  );
  return isBudgetRevision(revision) ? normal * 0.7 : normal;
}

/** Ensure the draft stays within budget and references only grounded venues. */
function validateDraft(
  draft: DiningDraft,
  places: Place[],
  maxDailyPerPerson: number,
): DiningDraft {
  const parsed = DiningDraft.parse(draft);
  const picks = dedupeEntries(parsed.picks);
  if (parsed.dailyBudgetPerPerson > maxDailyPerPerson + Number.EPSILON) {
    throw new Error("Dining estimate exceeds its planning guardrail.");
  }
  const candidates = new Set(places.map((place) => normalize(place.name)));
  if (candidates.size === 0 && picks.length > 0) {
    throw new Error("Dining cannot invent venues without place candidates.");
  }
  for (const pick of picks) {
    if (!candidates.has(normalize(pick.name))) {
      throw new Error(`Dining returned an ungrounded venue: ${pick.name}`);
    }
  }
  return {
    ...parsed,
    picks: picks.map((pick) => ({
      ...pick,
      name: canonicalPlaceName(pick.name, places),
    })),
  };
}

/** Produce grounded venue suggestions and a conservative budget without a model. */
function fallbackDraft(
  places: Place[],
  preferences: UserPreference[],
  maxDailyPerPerson: number,
): DiningDraft {
  const constraintText = preferences.length
    ? ` Ask the venue to confirm these requirements directly: ${preferences.map(({ key, value }) => `${key}=${value}`).join(", ")}.`
    : " Confirm ingredients and dietary suitability directly with the venue.";
  return {
    summary: places.length
      ? `${places.length} grounded dining candidate(s) within a whole-trip meal budget envelope`
      : "No grounded dining candidates; using a whole-trip meal budget envelope",
    dailyBudgetPerPerson: Math.min(50, maxDailyPerPerson),
    picks: places.slice(0, 5).map((place) => ({
      name: place.name,
      detail: `${place.category} candidate${place.rating ? ` with supplied rating ${place.rating}` : ""}.${constraintText}`,
    })),
    assumptions: ["Cuisine, menu, certification and availability require direct confirmation."],
  };
}

/** Build the LangChain generator around one read-only evidence tool. */
function createMiniMaxGenerator(): DiningGenerator | undefined {
  const model = createRoutedChatModel("dining");
  if (!model) return undefined;

  return {
    async generate(input) {
      // The model receives facts through this tool instead of relying on hidden context.
      const evidence = tool(async () => input, {
        name: "read_dining_evidence",
        description:
          "Read the validated trip facts, grounded restaurant candidates, confirmed dietary preferences, budget ceiling and revision request.",
        schema: z.object({}),
      });
      const specialist = createAgent({
        name: "dining_specialist",
        model,
        tools: [evidence],
        systemPrompt:
          "You are the dining specialist. Always call read_dining_evidence and use only its facts and exact venue names. Stay within its daily per-person AUD ceiling and address any revision. Never claim live hours, availability, menu items, allergen safety, certification or dietary suitability; tell travellers to confirm important constraints directly. Return the requested structured dining draft.\n\nEach pick's name must be a candidate's name copied character for character, with no category, rating or district appended. Return no picks rather than inventing a venue that is not in the evidence.",
        responseFormat: DiningDraft,
      });
      const result = await specialist.invoke({
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              task: "Draft dining guidance from the validated evidence available through your tool.",
              tripId: input.brief.tripId,
              revision: input.revision?.reason,
            }),
          },
        ],
      });
      return readStructuredResponse("dining", DiningDraft, result);
    },
  };
}

async function planDining(
  briefInput: TripBrief,
  ctx: AgentContext,
  options: DiningAgentOptions,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  // Gather map candidates and persisted preferences before applying the budget
  // guardrail and choosing either the injected or deterministic generator.
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = tripDays(brief.dates);
  const [candidatePlaces, allPreferences] = await Promise.all([
    ctx.tools.maps.places({ near: brief.destination, category: "restaurant" }),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const places = uniquePlaces(candidatePlaces);
  const preferences = dietaryPreferences(allPreferences);
  const ceiling = budgetCeiling(brief, days, revision);
  const generator =
    options.generator === false ? undefined : (options.generator ?? createMiniMaxGenerator());
  let draft: DiningDraft;
  let usedFallback = !generator;
  if (generator) {
    try {
      draft = validateDraft(
        await generator.generate({
          brief,
          days,
          places,
          dietaryPreferences: preferences,
          maxDailyPerPerson: ceiling,
          revision,
        }),
        places,
        ceiling,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(`[dining] Model draft failed; using a safe local plan: ${reason}`);
      usedFallback = true;
      draft = fallbackDraft(places, preferences, ceiling);
    }
  } else {
    draft = fallbackDraft(places, preferences, ceiling);
  }

  const total = Number((draft.dailyBudgetPerPerson * brief.groupSize * days).toFixed(2));
  // Keep venue picks informational; only the whole-trip meal envelope is priced.
  return {
    agent: "dining",
    summary: `${draft.summary} · AUD ${total.toFixed(2)} meal budget`,
    items: [
      {
        kind: "meal-budget",
        detail: `${days} planning day(s) × ${brief.groupSize} traveller(s) × AUD ${draft.dailyBudgetPerPerson.toFixed(2)} per person/day.`,
        estCost: total,
      },
      ...draft.picks.map((pick) => ({
        kind: "meal",
        location: pick.name,
        detail: `${pick.name}: ${pick.detail}`,
      })),
    ],
    assumptions: [
      "The priced item is a budget envelope, not a reservation or a sum of the unpriced venue candidates.",
      "Venue data comes only from the injected MapsPort; menus, dietary suitability and availability require direct confirmation.",
      ...(preferences.length
        ? [
            `Applied confirmed dietary preferences: ${preferences.map(({ key, value }) => `${key}=${value}`).join(", ")}.`,
          ]
        : ["No confirmed dietary preferences were found in long-term memory."]),
      ...(revision ? [`Revision requested: ${revision.reason}.`] : []),
      ...draft.assumptions,
    ],
    conflictsWith: [],
    source: usedFallback
      ? {
          kind: "fallback",
          label: "Local fallback",
          freshness: "The model dining draft was unavailable or invalid; deterministic meal guidance was used from the gathered venue evidence.",
        }
      : {
          kind: !mockEnabled() ? "estimated" : "mock",
          label: "Maps evidence and AI dining plan",
          freshness:
            !mockEnabled()
              ? "Venue details are provider estimates; menus, dietary suitability and availability require direct confirmation."
              : "Venue details come from deterministic mock fixtures; not live verified.",
        },
  };
}

/** Factory keeps provider behavior injectable while exposing the Specialist API. */
export function createDiningAgent(options: DiningAgentOptions = {}): Specialist {
  return {
    name: "dining",
    label: "Food & dining",
    supportsRevision: true,
    async invoke(request) {
      if (request.revision) {
        if (
          request.revision.tripId !== request.brief.tripId ||
          request.revision.targetAgent !== "dining"
        ) {
          throw new Error("Dining revision must target this trip and agent.");
        }
      }
      return planDining(request.brief, request.context, options, request.revision);
    },
  };
}

// Default instance used by the shared agent registry.
export const diningAgent = createDiningAgent();
