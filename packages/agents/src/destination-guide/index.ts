import {
  TripBrief as TripBriefSchema,
  type AgentContext,
  type AgentProposal,
  type Place,
  type Specialist,
  type TripBrief,
  type UserPreference,
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
import { summaryCopy } from "../summary-copy";
import {
  gatherWeatherEvidence,
  weatherPacking,
  weatherText,
  type DestinationWeatherEvidence,
} from "./weather-evidence";

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

const ModelGuideDraft = z.object({
  summary: z.string().trim().min(1),
  attractions: z.array(
    z.object({ name: z.string().trim().min(1), detail: z.string().trim().min(1) }),
  ),
  customs: z.array(z.string().trim().min(1)).min(1),
  safety: z.array(z.string().trim().min(1)).min(1),
  entryHealth: z.array(z.string().trim().min(1)).min(1),
  weather: z.string().trim().min(1),
  packing: z.array(z.string().trim().min(1)).min(1),
  assumptions: z.array(z.string().trim().min(1)),
});

export function fitDraft(draft: z.infer<typeof ModelGuideDraft>): DestinationGuideDraft {
  const each = (items: string[], count: number, max: number) =>
    items.slice(0, count).map((item) => clip(item, max));
  return DestinationGuideDraft.parse({
    summary: clip(draft.summary, 400),
    attractions: draft.attractions
      .slice(0, 5)
      .map(({ name, detail }) => ({ name, detail: clip(detail, 500) })),
    customs: each(draft.customs, 4, 400),
    safety: each(draft.safety, 4, 400),
    entryHealth: each(draft.entryHealth, 4, 400),
    weather: clip(draft.weather, 500),
    packing: each(draft.packing, 6, 300),
    assumptions: each(draft.assumptions, 6, 400),
  });
}

export type DestinationGuideDraft = z.infer<typeof DestinationGuideDraft>;

export interface DestinationGuideGenerator {
  generate(input: {
    brief: TripBrief;
    travelMonth: string;
    places: Place[];
    preferences: UserPreference[];
    weatherEvidence: DestinationWeatherEvidence[];
    language?: InterfaceLanguage;
  }): Promise<DestinationGuideDraft>;
}

export interface DestinationGuideAgentOptions {
  generator?: DestinationGuideGenerator | false;
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
  const attractions = dedupeEntries(parsed.attractions);
  const candidates = new Set(places.map((place) => normalize(place.name)));
  if (candidates.size === 0 && attractions.length > 0) {
    throw new Error("Destination guide cannot invent attractions without place candidates.");
  }
  for (const attraction of attractions) {
    if (!candidates.has(normalize(attraction.name))) {
      throw new Error(`Destination guide returned an ungrounded attraction: ${attraction.name}`);
    }
  }
  return {
    ...parsed,
    attractions: attractions.map((attraction) => ({
      ...attraction,
      name: canonicalPlaceName(attraction.name, places),
    })),
  };
}

function fallbackDraft(
  brief: TripBrief,
  month: string,
  places: Place[],
  language: InterfaceLanguage | undefined,
  weatherEvidence: DestinationWeatherEvidence[],
): DestinationGuideDraft {
  const packing = weatherPacking(weatherEvidence);
  return {
    summary: summaryCopy(language).guide(brief.destination, brief.dates[0]),
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
      ...(packing.length ? packing : ["Weather-appropriate layers"]),
      "Comfortable walking shoes",
      "Medication and copies of prescriptions",
      "Travel documents and suitable power adapters",
    ],
    assumptions: ["Destination-specific claims are limited to the validated evidence available."],
  };
}

function createMiniMaxGenerator(): DestinationGuideGenerator | undefined {
  const model = createRoutedChatModel("destination-guide");
  if (!model) return undefined;

  return {
    async generate(input) {
      const evidence = tool(async () => input, {
        name: "read_destination_evidence",
        description:
          "Read the validated trip brief, travel month, grounded map candidates, confirmed preferences and dated forecast or historical climate evidence, including unavailable dates.",
        schema: z.object({}),
      });
      const specialist = createAgent({
        name: "destination_specialist",
        model,
        tools: [evidence],
        systemPrompt:
          "You are the destination specialist. Always call read_destination_evidence before answering and use only its facts. Attraction names must be a grounded candidate's name copied character for character, with no category, rating or district appended. Give concise customs, packing and planning guidance. Use weatherEvidence to choose packing for the supplied conditions. Its forecast entries are dated forecasts; climate entries are historical context, never forecasts. Unavailable entries supply no weather facts. If no weather evidence is supplied, use monthly planning context only. Never assert entry eligibility, vaccine requirements or that an area is safe; direct travellers to current official immigration, health and travel-advisory sources. Never claim live opening hours or availability. Return the requested structured destination guide.\n\nKeep within these lengths; longer text is cut at a sentence end: summary at most 400 characters; at most 5 attractions, each detail at most 500 characters; customs, safety and entryHealth are each 1-4 strings of at most 400 characters; weather at most 500 characters; packing 1-6 strings of at most 300 characters; assumptions at most 6 strings.\n\n" +
          TRAVELLER_PREFERENCES_RULE +
          replyLanguageRule(input.language),
        responseFormat: ModelGuideDraft,
      });
      const result = await specialist.invoke({
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              task: "Prepare destination guidance from the validated evidence available through your tool.",
              tripId: input.brief.tripId,
            }),
          },
        ],
      });
      return fitDraft(readStructuredResponse("destination-guide", ModelGuideDraft, result));
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
  const [cityPlaces, preferences] = await Promise.all([
    Promise.all(
      brief.destination.split("&").map(async (name) => {
        const city = name.trim();
        const [sights, museums] = await Promise.all([
          ctx.tools.maps.places({ near: city, category: "sight" }),
          ctx.tools.maps.places({ near: city, category: "museum" }),
        ]);
        return { city, places: dedupeEntries([...sights, ...museums]) };
      }),
    ),
    ctx.mem.getLongTerm(brief.userId),
  ]);
  ctx.signal?.throwIfAborted();
  const places = dedupeEntries(cityPlaces.flatMap(({ places }) => places));
  const weatherEvidence = await gatherWeatherEvidence(brief, ctx, cityPlaces);
  const weatherResults = weatherEvidence.flatMap(({ result }) => (result ? [result] : []));
  const weatherResult = weatherResults[0];
  const weatherUnavailable = weatherEvidence.some(({ unavailable }) => unavailable);
  const generator =
    options.generator === false ? undefined : (options.generator ?? createMiniMaxGenerator());
  let draft: DestinationGuideDraft;
  let usedFallback = !generator;
  if (generator) {
    try {
      draft = validateDraft(
        await generator.generate({
          brief,
          travelMonth: month,
          places,
          preferences,
          weatherEvidence,
          ...(ctx.replyLanguage ? { language: ctx.replyLanguage } : {}),
        }),
        places,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown model error";
      console.warn(`[destination-guide] Model draft failed; using a safe local plan: ${reason}`);
      usedFallback = true;
      ctx.signal?.throwIfAborted();
      draft = fallbackDraft(brief, month, places, ctx.replyLanguage, weatherEvidence);
    }
  } else {
    draft = fallbackDraft(brief, month, places, ctx.replyLanguage, weatherEvidence);
  }

  ctx.signal?.throwIfAborted();
  const monthLabel = (date: string) =>
    new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${date}T12:00:00Z`),
    );
  const scope =
    brief.dates[0].slice(0, 7) !== brief.dates[1].slice(0, 7)
      ? `Planning context for ${monthLabel(brief.dates[0])} only; recheck guidance for the remaining months through ${monthLabel(brief.dates[1])}. `
      : "";
  const packing = draft.packing.map((item) => item.replace(/[\s.!;,]+$/, "")).filter(Boolean);

  return {
    agent: "destination-guide",
    summary: draft.summary,
    items: [
      ...draft.attractions.map((attraction) => ({
        kind: "attraction",
        location: attraction.name,
        detail: `${attraction.name}: ${attraction.detail}`,
      })),
      { kind: "customs", detail: draft.customs.join(" ") },
      { kind: "safety", detail: scope + draft.safety.join(" ") },
      {
        kind: "entry-health",
        detail: `${scope}${draft.entryHealth.join(" ")} Verify all entry and health rules against current official government sources before booking or departure.`,
      },
      {
        kind: "weather-packing",
        detail: weatherEvidence.length
          ? weatherText(weatherEvidence, ctx.replyLanguage)
          : scope + draft.weather,
        packing,
      },
    ],
    assumptions: [
      mockEnabled()
        ? "Attractions come only from the injected MapsPort and may still be mock or stale data."
        : "Attractions come from provider candidates; opening hours and availability may be stale and require verification.",
      ...(weatherEvidence.length
        ? weatherEvidence.map(({ city, targetDate, result }) =>
            result
              ? `${city}, ${targetDate}: Weather source: ${result.provider}; ${result.horizon}${result.validUntil ? `, valid until ${result.validUntil}` : ""}; observed ${result.observedAt}.`
              : `${city}, ${targetDate}: Weather provider unavailable; check conditions before travel.`,
          )
        : [
            "Weather is general model context, not a forecast; entry, health and safety guidance requires official verification.",
          ]),
      ...draft.assumptions,
    ],
    conflictsWith: [],
    source: usedFallback
      ? {
          kind: "fallback",
          label: "Local fallback",
          freshness:
            "The model guide was unavailable or invalid; deterministic destination guidance was used from the gathered place evidence.",
        }
      : weatherUnavailable
        ? {
            kind: "unavailable",
            label: "Weather provider",
            freshness:
              "Some requested destination dates have no weather evidence; unavailable dates are listed explicitly.",
          }
        : {
            kind:
              weatherResults.length > 0 &&
              weatherResults.every((result) =>
                /^(Google Weather API|Open-Meteo)/.test(result.provider),
              )
                ? "live"
                : !mockEnabled()
                  ? "estimated"
                  : "mock",
            label: weatherResult
              ? [...new Set(weatherResults.map(({ provider }) => provider))].join(" / ")
              : "Maps evidence and AI guide",
            freshness: weatherResult
              ? `Weather evidence for ${brief.dates[0]} through ${brief.dates[1]}; each dated entry records its forecast or historical climate horizon and observation time. Conditions and provider availability may change.`
              : !mockEnabled()
                ? "Place details are provider estimates; weather, entry, health and safety claims require official verification."
                : "Place details come from deterministic mock fixtures; not live verified.",
          },
  };
}

export function createDestinationGuideAgent(
  options: DestinationGuideAgentOptions = {},
): Specialist {
  return {
    name: "destination-guide",
    label: "Destination guide",
    async invoke({ brief, context, revision }) {
      if (revision) {
        throw new Error("Destination guide does not support targeted revisions.");
      }
      return planDestinationGuide(brief, context, options);
    },
  };
}

export const destinationGuideAgent = createDestinationGuideAgent();
