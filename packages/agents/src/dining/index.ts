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
  type InterfaceLanguage,
} from "@trip/shared";
import { z } from "zod/v4";
import { createAgent, tool } from "langchain";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { mockEnabled } from "@trip/tools";
import { clip } from "../clip";
import { normalize, canonicalPlaceName, dedupeEntries } from "../place-names";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";
import { replyLanguageRule } from "../prompts/reply-language";
import { plural, summaryCopy } from "../summary-copy";
import { revisionIntent, REVISION_INTENT_RULE } from "../revision-intent";

const DAY_MS = 86_400_000;
const DINING_BUDGET_SHARE = 0.2;

const DAILY_MEAL_RATE = 80;

const DiningPick = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
});

const DiningDraft = z.object({
  summary: z.string().trim().min(1).max(400),
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
    dailyBudgetPerPerson: number;
    revision?: RevisionRequest;

    currency?: Currency;
    language?: InterfaceLanguage;
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
  const nights = Math.round((parse(end) - parse(start)) / DAY_MS);
  if (!Number.isSafeInteger(nights) || nights < 0)
    throw new Error("Dining requires ordered dates.");
  return nights + 1;
}

function dietaryPreferences(preferences: UserPreference[]): UserPreference[] {
  return preferences.filter((preference) =>
    /diet|food|meal|allerg|halal|kosher|vegetarian|vegan|plant[- ]based|gluten|lactose|celiac|shellfish|pescatarian|peanut|\bnuts?\b|素食|吃素|全素|过敏|過敏|花生|坚果|堅果|清真|麸质|麩質|乳糖|不吃|忌口|纯素|犹太洁食/i.test(
      `${preference.key} ${preference.value}`,
    ),
  );
}

export function dietaryPreferencesForBrief(
  brief: TripBrief,
  saved: UserPreference[],
): UserPreference[] {
  for (const values of [brief.learnedPreferences, brief.preferences]) {
    const explicit = dietaryPreferences(
      (values ?? []).map((value) => ({ key: "preference", value, source: "filter" as const })),
    );
    if (explicit.length) return explicit.map((item) => ({ ...item, key: "dietary" }));
  }
  return dietaryPreferences(saved);
}

function mealRate(
  brief: TripBrief,
  days: number,
  revision?: RevisionRequest,
  allocation?: BudgetAllocation,
): number {
  const cents = (value: number) => Math.floor(value * 100) / 100;
  if (allocation)
    return cents(Math.min(DAILY_MEAL_RATE, allocation.budget / (brief.groupSize * days)));
  const normal = Math.min(
    DAILY_MEAL_RATE,
    (brief.budgetTotal * DINING_BUDGET_SHARE) / (brief.groupSize * days),
  );
  return cents(revisionIntent(revision).budget ? normal * 0.7 : normal);
}

function validateDraft(draft: DiningDraft, places: Place[]): DiningDraft {
  const parsed = DiningDraft.parse(draft);
  if (
    /allerg(?:y|en)[ -](?:safe|free)|(?:peanut|nut)[ -]free|safe for[^.]*allerg|保证[^。]*不过敏|保證[^。]*不過敏/i.test(
      [parsed.summary, ...parsed.picks.map(({ detail }) => detail), ...parsed.assumptions].join(
        " ",
      ),
    )
  )
    throw new Error("Dining cannot verify allergen safety from place candidates.");
  const picks = dedupeEntries(parsed.picks);
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
  language: InterfaceLanguage | undefined,
): DiningDraft {
  const requirements = preferences.map(({ key, value }) => `${key}=${value}`).join(", ");
  return {
    summary: summaryCopy(language).diningCandidates(places.length),
    picks: places.slice(0, 5).map((place) => ({
      name: place.name,
      detail: summaryCopy(language).diningPick(place.category, place.rating, requirements),
    })),
    assumptions: ["Cuisine, menu, certification and availability require direct confirmation."],
  };
}

const ModelDiningDraft = z.object({
  summary: z.string().trim().min(1),
  picks: z.array(z.object({ name: z.string().trim().min(1), detail: z.string().trim().min(1) })),
  assumptions: z.array(z.string().trim().min(1)),
});

export function fitDiningDraft(draft: z.infer<typeof ModelDiningDraft>): DiningDraft {
  return DiningDraft.parse({
    summary: clip(draft.summary, 400),
    picks: draft.picks
      .slice(0, 5)
      .map(({ name, detail }) => ({ name: clip(name, 120), detail: clip(detail, 500) })),
    assumptions: draft.assumptions.slice(0, 6).map((assumption) => clip(assumption, 400)),
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
          "Read the validated trip facts, grounded restaurant candidates, confirmed dietary preferences, the fixed per-person daily meal budget and revision request.",
        schema: z.object({}),
      });
      const specialist = createAgent({
        name: "dining_specialist",
        model,
        tools: [evidence],
        systemPrompt:
          "You are the dining specialist. Always call read_dining_evidence and use only its facts and exact venue names. Pick venues that suit its fixed per-person daily meal budget, which the planner sets, and address any revision. Never claim live hours, availability, menu items, allergen safety, certification or dietary suitability; tell travellers to confirm important constraints directly. Return the requested structured dining draft.\n\nEach pick's name must be a candidate's name copied character for character, with no category, rating or district appended. Return no picks rather than inventing a venue that is not in the evidence.\n\n" +
          REVISION_INTENT_RULE +
          TRAVELLER_PREFERENCES_RULE +
          replyLanguageRule(input.language),
        responseFormat: ModelDiningDraft,
      });
      const result = await specialist.invoke({
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              task: "Draft dining guidance from the validated evidence available through your tool.",
              tripId: input.brief.tripId,
              revision: input.revision && {
                kind: input.revision.kind,
                reason: input.revision.reason,
                constraints: input.revision.constraints,
                intent: revisionIntent(input.revision),
              },
            }),
          },
        ],
      });
      return fitDiningDraft(readStructuredResponse("dining", ModelDiningDraft, result));
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
  const allPreferences = await ctx.mem.getLongTerm(brief.userId);
  ctx.signal?.throwIfAborted();
  const preferences = dietaryPreferencesForBrief(brief, allPreferences);
  const candidatePlaces = await ctx.tools.maps.places({
    near: brief.destination,
    category: "restaurant",
    ...(preferences.length
      ? {
          textQuery: `restaurant in ${brief.destination}; dietary requirements: ${preferences.map(({ value }) => value).join("; ")}`,
        }
      : {}),
  });
  ctx.signal?.throwIfAborted();
  const places = dedupeEntries(candidatePlaces);
  const dailyBudgetPerPerson = mealRate(brief, days, revision, allocation);
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
          dailyBudgetPerPerson,
          revision,
          currency,
          ...(ctx.replyLanguage ? { language: ctx.replyLanguage } : {}),
        }),
        places,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(`[dining] Model draft failed; using a safe local plan: ${reason}`);
      usedFallback = true;
      draft = fallbackDraft(places, preferences, ctx.replyLanguage);
    }
  } else {
    draft = fallbackDraft(places, preferences, ctx.replyLanguage);
  }

  const total = Number((dailyBudgetPerPerson * brief.groupSize * days).toFixed(2));

  return {
    agent: "dining",
    summary: summaryCopy(ctx.replyLanguage).dining(draft.summary, formatMoney(total, currency)),
    items: [
      {
        kind: "meal-budget",
        detail: `${plural(days, "planning day", "planning days")} × ${plural(brief.groupSize, "traveller", "travellers")} × ${formatMoney(dailyBudgetPerPerson, currency)} per person/day.`,
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
        : ["No dietary requirements were supplied for this trip or found in long-term memory."]),
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
