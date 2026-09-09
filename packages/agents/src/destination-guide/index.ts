import {
  TripBrief as TripBriefSchema,
  type Agent,
  type AgentContext,
  type AgentProposal,
  type Place,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { z } from "zod/v4";
import { createRoutedStructuredInvoker, routedModelName } from "../models";

const GuideAttraction = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
});

const DestinationGuideDraft = z.object({
  summary: z.string().trim().min(1).max(400),
  attractions: z.array(GuideAttraction).max(5),
  customs: z.array(z.string().trim().min(1).max(400)).min(1).max(4),
  safety: z.array(z.string().trim().min(1).max(400)).min(1).max(4),
  entryHealth: z.array(z.string().trim().min(1).max(400)).min(1).max(4),
  weather: z.string().trim().min(1).max(500),
  packing: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(6),
});

export type DestinationGuideDraft = z.infer<typeof DestinationGuideDraft>;

export interface DestinationGuideGenerator {
  generate(input: {
    brief: TripBrief;
    travelMonth: string;
    places: Place[];
    preferences: UserPreference[];
  }): Promise<DestinationGuideDraft>;
}

export interface DestinationGuideAgentOptions {
  /** Pass false to force the grounded deterministic guide. */
  generator?: DestinationGuideGenerator | false;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function travelMonth(date: string): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Destination guide requires a valid YYYY-MM-DD date: ${date}`);
  }
  return new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(timestamp);
}

function validateDraft(draft: DestinationGuideDraft, places: Place[]): DestinationGuideDraft {
  const parsed = DestinationGuideDraft.parse(draft);
  const candidates = new Set(places.map((place) => normalize(place.name)));
  if (candidates.size === 0 && parsed.attractions.length > 0) {
    throw new Error("Destination guide cannot invent attractions without place candidates.");
  }
  for (const attraction of parsed.attractions) {
    if (!candidates.has(normalize(attraction.name))) {
      throw new Error(`Destination guide returned an ungrounded attraction: ${attraction.name}`);
    }
  }
  return parsed;
}

function fallbackDraft(brief: TripBrief, month: string, places: Place[]): DestinationGuideDraft {
  return {
    summary: `Practical pre-trip checklist for ${brief.destination}`,
    attractions: places.slice(0, 5).map((place) => ({
      name: place.name,
      detail: `${place.category} candidate${place.rating ? ` with supplied rating ${place.rating}` : ""}; verify opening hours and suitability before visiting.`,
    })),
    customs: ["Follow posted venue rules and check official local visitor guidance before travel."],
    safety: [
      "Save local emergency contacts, keep copies of essential documents, and follow current official travel advisories.",
    ],
    entryHealth: [
      `Check current official immigration and public-health requirements${brief.nationality ? ` for a ${brief.nationality} passport` : " for each traveller's passport"}; requirements can change.`,
    ],
    weather: `For ${month}, use this as planning context only and check an official short-range forecast shortly before departure.`,
    packing: [
      "Weather-appropriate layers",
      "Comfortable walking shoes",
      "Medication and copies of prescriptions",
      "Travel documents and suitable power adapters",
    ],
    assumptions: ["Deterministic fallback avoids unsourced destination-specific claims."],
  };
}

function createRoutedGenerator(): DestinationGuideGenerator | undefined {
  const structured = createRoutedStructuredInvoker(
    "destination-guide",
    DestinationGuideDraft,
    "DestinationGuideDraft",
  );
  if (!structured) return undefined;

  return {
    async generate(input) {
      return structured(
        `Create concise destination guidance using only the supplied trip facts and attraction candidates. Hard limits, which the tool schema states but you must also respect literally: summary at most 400 characters; at most 5 attractions; customs, safety and entryHealth are arrays of at most 4 strings each; weather at most 500 characters; packing at most 6 strings; assumptions at most 6 strings. Attraction names must exactly match candidate names; return no attractions if the list is empty. Weather must be described as typical planning context for the month, never a forecast. Do not state that a traveller is eligible to enter, that a vaccine is required, or that an area is safe. Instead, give practical checks and clearly direct the traveller to current official immigration, public-health and travel-advisory sources. Never claim live opening hours or availability. Respect confirmed preferences without inventing facts.\n\nTrip brief:\n${JSON.stringify(input.brief)}\n\nTravel month:\n${input.travelMonth}\n\nConfirmed preferences:\n${JSON.stringify(input.preferences)}\n\nAttraction candidates from MapsPort:\n${JSON.stringify(input.places)}`,
      );
    },
  };
}

async function planDestinationGuide(
  briefInput: TripBrief,
  ctx: AgentContext,
  options: DestinationGuideAgentOptions,
): Promise<AgentProposal> {
  ctx.signal?.throwIfAborted();
  const brief = TripBriefSchema.parse(briefInput);
  const month = travelMonth(brief.dates[0]);
  const [sights, museums, preferences] = await Promise.all([
    ctx.tools.maps.places({ near: brief.destination, category: "sight" }),
    ctx.tools.maps.places({ near: brief.destination, category: "museum" }),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const places = [...sights, ...museums].filter(
    (place, index, all) =>
      all.findIndex((candidate) => normalize(candidate.name) === normalize(place.name)) === index,
  );
  const generator =
    options.generator === false ? undefined : (options.generator ?? createRoutedGenerator());
  let draft: DestinationGuideDraft;
  let source = "Deterministic fallback";

  if (generator) {
    try {
      draft = validateDraft(
        await generator.generate({ brief, travelMonth: month, places, preferences }),
        places,
      );
      source = options.generator ? "Injected generator" : routedModelName("destination-guide");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(
        `[destination-guide] Model draft failed; using deterministic fallback: ${reason}`,
      );
      draft = fallbackDraft(brief, month, places);
    }
  } else {
    draft = fallbackDraft(brief, month, places);
  }

  return {
    agent: "destination-guide",
    model: source,
    summary: draft.summary,
    items: [
      ...draft.attractions.map((attraction) => ({
        kind: "attraction",
        location: attraction.name,
        detail: `${attraction.name}: ${attraction.detail}`,
      })),
      { kind: "customs", detail: draft.customs.join(" ") },
      { kind: "safety", detail: draft.safety.join(" ") },
      {
        kind: "entry-health",
        detail: `${draft.entryHealth.join(" ")} Verify all entry and health rules against current official government sources before booking or departure.`,
      },
      {
        kind: "weather-packing",
        detail: `${draft.weather} Pack: ${draft.packing.join(", ")}.`,
      },
    ],
    assumptions: [
      `Guide source: ${source}.`,
      "Attractions come only from the injected MapsPort and may still be mock or stale data.",
      "Weather is general model context, not a forecast; entry, health and safety guidance requires official verification.",
      ...draft.assumptions,
    ],
    conflictsWith: [],
  };
}

export function createDestinationGuideAgent(options: DestinationGuideAgentOptions = {}): Agent {
  return {
    name: "destination-guide",
    label: "Destination guide",
    run: (brief, ctx) => planDestinationGuide(brief, ctx, options),
  };
}

export const destinationGuideAgent = createDestinationGuideAgent();
