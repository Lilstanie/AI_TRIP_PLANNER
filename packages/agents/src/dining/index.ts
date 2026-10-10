import {
  displayCurrencyOf,
  formatMoney,
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type Currency,
  type Place,
  type RevisionRequest,
  type Specialist,
  type TripBrief,
  type UserPreference,
  type BudgetAllocation,
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { mockEnabled } from "@trip/tools";
import { clip } from "../clip";
import { normalize, canonicalPlaceName, dedupeEntries } from "../place-names";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";

const DAY_MS = 86_400_000;
const DINING_BUDGET_SHARE = 0.2;

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

export type DiningDraft = z.infer<typeof DiningDraft>;

export interface DiningGenerator {
  generate(input: {
    brief: TripBrief;
    days: number;
    places: Place[];
    dietaryPreferences: UserPreference[];
    maxDailyPerPerson: number;
    revision?: RevisionRequest;

    currency?: Currency;
  }): Promise<DiningDraft>;
}

export interface DiningAgentOptions {
  generator?: DiningGenerator | false;
}

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

function dietaryPreferences(preferences: UserPreference[]): UserPreference[] {
  return preferences.filter((preference) =>
    /diet|food|meal|allerg|halal|kosher|vegetarian|vegan|plant[- ]based|gluten|lactose|celiac|shellfish|pescatarian/i.test(
      `${preference.key} ${preference.value}`,
    ),
  );
}

function isBudgetRevision(revision?: RevisionRequest): boolean {
  return Boolean(
    revision &&
    /budget|cost|cheaper|overrun|cut|reduce/i.test(
      [revision.reason, ...revision.constraints].join(" "),
    ),
  );
}

function budgetCeiling(
  brief: TripBrief,
  days: number,
  revision?: RevisionRequest,
  allocation?: BudgetAllocation,
): number {
  if (allocation)
    return Math.min(MAX_DAILY_PER_PERSON, allocation.budget / (brief.groupSize * days));
  const normal = Math.min(
    MAX_DAILY_PER_PERSON,
    (brief.budgetTotal * DINING_BUDGET_SHARE) / (brief.groupSize * days),
  );
  return isBudgetRevision(revision) ? normal * 0.7 : normal;
}

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

const ModelDiningDraft = z.object({
  summary: z.string().trim().min(1),
  dailyBudgetPerPerson: z.number().nonnegative(),
  picks: z.array(z.object({ name: z.string().trim().min(1), detail: z.string().trim().min(1) })),
  assumptions: z.array(z.string().trim().min(1)),
});

export function fitDiningDraft(
  draft: z.infer<typeof ModelDiningDraft>,
  maxDailyPerPerson: number,
  currency: Currency = "AUD",
): DiningDraft {
  const capped = draft.dailyBudgetPerPerson > maxDailyPerPerson;
  return DiningDraft.parse({
    summary: clip(draft.summary, 400),

    dailyBudgetPerPerson: Math.min(draft.dailyBudgetPerPerson, maxDailyPerPerson),
    picks: draft.picks
      .slice(0, 5)
      .map(({ name, detail }) => ({ name: clip(name, 120), detail: clip(detail, 500) })),
    assumptions: [
      ...(capped
        ? [
            `Meal estimate of ${formatMoney(draft.dailyBudgetPerPerson, currency)} per person/day capped at the ${formatMoney(maxDailyPerPerson, currency)} this plan leaves for meals.`,
          ]
        : []),
      ...draft.assumptions,
    ]
      .slice(0, 6)
      .map((assumption) => clip(assumption, 400)),
  });
}

function createMiniMaxGenerator(): DiningGenerator | undefined {
  const model = createRoutedChatModel("dining");
  if (!model) return undefined;

  return {
    async generate(input) {
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
          "You are the dining specialist. Always call read_dining_evidence and use only its facts and exact venue names. Stay within its daily per-person AUD ceiling and address any revision. Never claim live hours, availability, menu items, allergen safety, certification or dietary suitability; tell travellers to confirm important constraints directly. Return the requested structured dining draft.\n\nEach pick's name must be a candidate's name copied character for character, with no category, rating or district appended. Return no picks rather than inventing a venue that is not in the evidence.\n\n" +
          TRAVELLER_PREFERENCES_RULE,
        responseFormat: ModelDiningDraft,
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
      return fitDiningDraft(
        readStructuredResponse("dining", ModelDiningDraft, result),
        input.maxDailyPerPerson,
        input.currency,
      );
    },
  };
}

async function planDining(
  briefInput: TripBrief,
  ctx: AgentContext,
  options: DiningAgentOptions,
  revision?: RevisionRequest,
  allocation?: BudgetAllocation,
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = tripDays(brief.dates);
  const [candidatePlaces, allPreferences] = await Promise.all([
    ctx.tools.maps.places({ near: brief.destination, category: "restaurant" }),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const places = dedupeEntries(candidatePlaces);
  const preferences = dietaryPreferences(allPreferences);
  const ceiling = budgetCeiling(brief, days, revision, allocation);
  const currency = displayCurrencyOf(brief, ctx);
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
          currency,
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

  return {
    agent: "dining",
    summary: `${draft.summary} · ${formatMoney(total, currency)} meal budget`,
    items: [
      {
        kind: "meal-budget",
        detail: `${days} planning day(s) × ${brief.groupSize} traveller(s) × ${formatMoney(draft.dailyBudgetPerPerson, currency)} per person/day.`,
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
          freshness:
            "The model dining draft was unavailable or invalid; deterministic meal guidance was used from the gathered venue evidence.",
        }
      : {
          kind: !mockEnabled() ? "estimated" : "mock",
          label: "Maps evidence and AI dining plan",
          freshness: !mockEnabled()
            ? "Venue details are provider estimates; menus, dietary suitability and availability require direct confirmation."
            : "Venue details come from deterministic mock fixtures; not live verified.",
        },
  };
}

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
      return planDining(
        request.brief,
        request.context,
        options,
        request.revision,
        request.allocation,
      );
    },
  };
}

export const diningAgent = createDiningAgent();
