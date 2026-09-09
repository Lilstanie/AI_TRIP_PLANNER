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
import { createRoutedStructuredInvoker, routedModelName } from "../models";

const DAY_MS = 86_400_000;
const DINING_BUDGET_SHARE = 0.2;
const MAX_DAILY_PER_PERSON_USD = 75;

const DiningPick = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
});

const DiningDraft = z.object({
  summary: z.string().trim().min(1).max(400),
  dailyBudgetPerPersonUsd: z.number().nonnegative(),
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
    maxDailyPerPersonUsd: number;
    revision?: RevisionRequest;
  }): Promise<DiningDraft>;
}

export interface DiningAgentOptions {
  /** Pass false to force deterministic recommendations and budgeting. */
  generator?: DiningGenerator | false;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
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
    /diet|food|meal|allerg|halal|kosher|vegetarian|vegan|gluten|lactose/i.test(
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

function budgetCeiling(brief: TripBrief, days: number, revision?: RevisionRequest): number {
  const normal = Math.min(
    MAX_DAILY_PER_PERSON_USD,
    (brief.budgetTotal * DINING_BUDGET_SHARE) / (brief.groupSize * days),
  );
  return isBudgetRevision(revision) ? normal * 0.7 : normal;
}

function validateDraft(
  draft: DiningDraft,
  places: Place[],
  maxDailyPerPersonUsd: number,
): DiningDraft {
  const parsed = DiningDraft.parse(draft);
  if (parsed.dailyBudgetPerPersonUsd > maxDailyPerPersonUsd + Number.EPSILON) {
    throw new Error("Dining estimate exceeds its planning guardrail.");
  }
  const candidates = new Set(places.map((place) => normalize(place.name)));
  if (candidates.size === 0 && parsed.picks.length > 0) {
    throw new Error("Dining cannot invent venues without place candidates.");
  }
  for (const pick of parsed.picks) {
    if (!candidates.has(normalize(pick.name))) {
      throw new Error(`Dining returned an ungrounded venue: ${pick.name}`);
    }
  }
  return parsed;
}

function fallbackDraft(
  places: Place[],
  preferences: UserPreference[],
  maxDailyPerPersonUsd: number,
): DiningDraft {
  const constraintText = preferences.length
    ? ` Ask the venue to confirm these requirements directly: ${preferences.map(({ key, value }) => `${key}=${value}`).join(", ")}.`
    : " Confirm ingredients and dietary suitability directly with the venue.";
  return {
    summary: "Grounded dining candidates with a whole-trip meal budget envelope",
    dailyBudgetPerPersonUsd: Math.min(50, maxDailyPerPersonUsd),
    picks: places.slice(0, 5).map((place) => ({
      name: place.name,
      detail: `${place.category} candidate${place.rating ? ` with supplied rating ${place.rating}` : ""}.${constraintText}`,
    })),
    assumptions: [
      "Deterministic fallback does not infer cuisine, menu, certification or availability.",
    ],
  };
}

function createRoutedGenerator(): DiningGenerator | undefined {
  const structured = createRoutedStructuredInvoker("dining", DiningDraft, "DiningDraft");
  if (!structured) return undefined;

  return {
    async generate(input) {
      return structured(
        `Create concise dining recommendations and a realistic daily per-person meal budget in USD. Hard limits, which the tool schema states but you must also respect literally: summary at most 400 characters; at most 5 picks; each pick name at most 120 characters and each detail at most 500 characters; assumptions at most 6 strings of at most 400 characters each. The budget must be non-negative and no more than ${input.maxDailyPerPersonUsd.toFixed(2)}. Venue names must exactly match supplied candidate names; return no picks if candidates are empty. Never claim live opening hours, availability, menu items, allergen safety, halal/kosher certification or dietary suitability. Tell travellers to confirm important dietary constraints directly with venues. Respect every confirmed dietary preference. If a revision is supplied, address it within the stated budget ceiling.\n\nTrip brief:\n${JSON.stringify(input.brief)}\n\nTrip planning days:\n${input.days}\n\nConfirmed dietary preferences:\n${JSON.stringify(input.dietaryPreferences)}\n\nVenue candidates from MapsPort:\n${JSON.stringify(input.places)}\n\nRevision:\n${JSON.stringify(input.revision ?? null)}`,
      );
    },
  };
}

async function planDining(
  briefInput: TripBrief,
  ctx: AgentContext,
  options: DiningAgentOptions,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const days = tripDays(brief.dates);
  const [places, allPreferences] = await Promise.all([
    ctx.tools.maps.places({ near: brief.destination, category: "restaurant" }),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const preferences = dietaryPreferences(allPreferences);
  const ceiling = budgetCeiling(brief, days, revision);
  const generator =
    options.generator === false ? undefined : (options.generator ?? createRoutedGenerator());
  let draft: DiningDraft;
  let source = "Deterministic fallback";

  if (generator) {
    try {
      draft = validateDraft(
        await generator.generate({
          brief,
          days,
          places,
          dietaryPreferences: preferences,
          maxDailyPerPersonUsd: ceiling,
          revision,
        }),
        places,
        ceiling,
      );
      source = options.generator ? "Injected generator" : routedModelName("dining");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(`[dining] Model draft failed; using deterministic fallback: ${reason}`);
      draft = fallbackDraft(places, preferences, ceiling);
    }
  } else {
    draft = fallbackDraft(places, preferences, ceiling);
  }

  const total = Number((draft.dailyBudgetPerPersonUsd * brief.groupSize * days).toFixed(2));
  return {
    agent: "dining",
    model: source,
    summary: `${draft.summary} · USD ${total.toFixed(2)} meal budget`,
    items: [
      {
        kind: "meal-budget",
        detail: `${days} planning day(s) × ${brief.groupSize} traveller(s) × USD ${draft.dailyBudgetPerPersonUsd.toFixed(2)} per person/day.`,
        estCost: total,
      },
      ...draft.picks.map((pick) => ({
        kind: "meal",
        location: pick.name,
        detail: `${pick.name}: ${pick.detail}`,
      })),
    ],
    assumptions: [
      `Dining source: ${source}.`,
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
  };
}

export function createDiningAgent(options: DiningAgentOptions = {}): Agent {
  return {
    name: "dining",
    label: "Food & dining",
    run: (brief, ctx) => planDining(brief, ctx, options),
    async revise(brief, ctx, request) {
      if (request.tripId !== brief.tripId || request.targetAgent !== "dining") {
        throw new Error("Dining revision must target this trip and agent.");
      }
      return planDining(brief, ctx, options, request);
    },
  };
}

export const diningAgent = createDiningAgent();
