// Owner: C — lodging proposals and price revisions via injected tools and memory.
import {
  AgentProposal as AgentProposalSchema,
  type AgentProposal,
  type TripBrief,
  type AgentContext,
  type RevisionRequest,
  type Specialist,
  type ProviderProvenance,
  type StayOption,
} from "@trip/shared";
import { createAgent, tool } from "langchain";
import { z } from "zod/v4";
import { createRoutedChatModel, readStructuredResponse } from "../models";
import { chooseInitial, eligibleOptions, readPreferences, splitStay, stayCost } from "./planning";
import { TRAVELLER_PREFERENCES_RULE } from "../prompts/traveller-preferences";

/** A stay's candidate id, as published on the proposal: `stay-{day}-{index}`. */
const candidateId = (day: number, index: number) => `stay-${day}-${index}`;

interface StayEvidence {
  segments: ReturnType<typeof splitStay>;
  rooms: number;
  roomAllocation: string;
  groupSize: number;
  budgetRevision: boolean;
  searched: { segment: ReturnType<typeof splitStay>[number]; options: StayOption[] }[];
}

/**
 * Search every city once. Kept separate from assembly so the model's choice and the deterministic
 * choice cost the same single round of booking queries.
 */
async function gatherStayEvidence(
  brief: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<StayEvidence> {
  ctx.signal?.throwIfAborted();
  const segments = splitStay(brief);
  const prefs = brief.accommodation ?? readPreferences(await ctx.mem.getLongTerm(brief.userId));
  ctx.signal?.throwIfAborted();
  const rooms =
    prefs.roomAllocation === "individual" ? brief.groupSize : Math.ceil(brief.groupSize / 2);
  const budgetRevision =
    revision !== undefined &&
    /budget|cost|cheaper|overrun/i.test([revision.reason, ...revision.constraints].join(" "));
  // Search and filter each city independently; a multi-city trip is charged
  // only for the selected stay in each segment.
  const searched = await Promise.all(
    segments.map(async (segment) => {
      const options = eligibleOptions(
        await ctx.tools.booking.searchStays({
          city: segment.city,
          checkIn: segment.checkIn,
          checkOut: segment.checkOut,
          guests: brief.groupSize,
        }),
        prefs,
      );
      ctx.signal?.throwIfAborted();
      if (!options.length) {
        // Do not present an unpriceable stay as a successful $0 proposal. A can map this to HITL.
        throw new Error(
          `No valid stays in ${segment.city} match the confirmed accommodation preferences.`,
        );
      }
      return { segment, options };
    }),
  );
  return {
    segments,
    rooms,
    roomAllocation: prefs.roomAllocation,
    groupSize: brief.groupSize,
    budgetRevision,
    searched,
  };
}

/**
 * Turn searched candidates into a costed proposal.
 *
 * `pick` decides which candidate each segment gets. The deterministic rules are the default; the
 * model supplies one instead when it has chosen. Either way the cost is computed here from the
 * candidate's own rate — the chooser only ever names an option.
 */
function assembleStayProposal(
  evidence: StayEvidence,
  revision: RevisionRequest | undefined,
  pick: (segmentDay: number, options: StayOption[]) => StayOption,
  sourceKind: "estimated" | "mock" | "fallback" = "estimated",
): AgentProposal {
  const { segments, rooms, roomAllocation, groupSize, budgetRevision, searched } = evidence;
  const selections = searched.map(({ segment, options }) => {
    const initial = chooseInitial(options);
    const chosen = pick(segment.day, options);
    return {
      segment,
      options,
      chosen,
      initialCost: stayCost(initial, segment.nights, rooms),
      cost: stayCost(chosen, segment.nights, rooms),
    };
  });
  const total = selections.reduce((sum, stay) => sum + Math.round(stay.cost * 100), 0) / 100;
  const initialTotal =
    selections.reduce((sum, stay) => sum + Math.round(stay.initialCost * 100), 0) / 100;
  const savings = Math.round((initialTotal - total) * 100) / 100;
  // A real property does not imply a live price. Use the adapter's provenance
  // metadata so SerpApi rates and Google Places estimates cannot share a label.
  const grounded = selections.every(({ options }) => options.every((option) => option.grounded));
  const source = staySource(selections, sourceKind, grounded);
  const assumptions = [
    source.kind === "live"
      ? "AUD per room per night; rates came from a live search and can change before booking."
      : source.kind === "estimated"
        ? "AUD per room per night; property data is grounded but the nightly price is an estimate, not a live quote."
        : "Booking mock convention: AUD per room per night; at most 2 guests per room; availability is simulated.",
    `${roomAllocation} allocation: ${rooms} room(s) for ${groupSize} guest(s); check-out day is not charged.`,
    "Only selected stays contribute to estCost. Taxes/fees are assumed included in mock rates.",
    "Initial selection prefers rating >=8/10 and free cancellation; confirmed preferences remain mandatory during revisions.",
    "Trip budget covers every agent; no accommodation budget allocation is assumed. Orchestrator checks the combined cost.",
    ...selections.map(
      ({ segment, options }) =>
        `${segment.city}: compared ${options.length} eligible option(s): ` +
        options
          .map(
            (option) =>
              `${option.name} (AUD ${stayCost(option, segment.nights, rooms).toFixed(2)} total, ${option.rating}/10, ${option.freeCancellation ? "free cancellation" : "no free cancellation"})`,
          )
          .join("; ") +
        ". Only the selected option is charged.",
    ),
  ];
  if (segments.length > 1) {
    assumptions.push(
      "Cities separated by '&' are visited in listed order; nights are split evenly, with extras assigned to earlier cities. Confirm this schedule with the itinerary owner.",
    );
  }
  if (revision) {
    assumptions.push(
      `Revision requested: ${revision.reason}; constraints: ${revision.constraints.join("; ") || "none"}.`,
    );
    assumptions.push(
      budgetRevision
        ? `Selected the cheapest eligible stays; saved AUD ${savings.toFixed(2)} against the initial selection for these inputs. Dates, guest count and confirmed preferences are unchanged.`
        : "No supported price revision was requested; the initial selection is retained. Time/geography changes require an updated brief.",
    );
    if (budgetRevision) {
      const match = revision.constraints
        .join(" ")
        .match(/cut accommodation cost by ~?(\d+(?:\.\d+)?)%/i);
      if (match && Number(match[1]) >= 0 && Number(match[1]) <= 100) {
        const target = Math.round(initialTotal * (1 - Number(match[1]) / 100) * 100) / 100;
        assumptions.push(
          `Requested target: AUD ${target.toFixed(2)} or less. ${total <= target ? "Target met." : "Target cannot be met by eligible candidates; further budget decisions belong to the orchestrator."}`,
        );
      }
      if (savings === 0)
        assumptions.push(
          "No cheaper eligible stay is available; the estimate cannot be reduced further.",
        );
    }
  }
  return {
    agent: "accommodation",
    source,
    stays: selections.map(({ segment, options, chosen }) => ({
      id: `stay-${segment.day}`,
      ...segment,
      rooms,
      selectedId: candidateId(segment.day, options.indexOf(chosen)),
      candidates: options.map((option, index) => ({
        ...option,
        id: candidateId(segment.day, index),
      })),
    })),
    summary: `${rooms} room(s), ${segments.reduce((sum, segment) => sum + segment.nights, 0)} nights in ${segments.map((segment) => segment.city).join(" & ")} · AUD ${total.toFixed(2)}${budgetRevision ? " (lowest eligible cost)" : ""}`,
    items: selections.map(({ segment, chosen, cost }) => ({
      kind: "hotel",
      day: segment.day,
      estCost: cost,
      detail: `${chosen.name} — ${chosen.area}; ${segment.checkIn} to ${segment.checkOut}; ${rooms} room(s) × ${segment.nights} night(s) × AUD ${chosen.pricePerNight.toFixed(2)} per room/night = AUD ${cost.toFixed(2)}; rating ${chosen.rating}/10; ${chosen.freeCancellation ? "free cancellation" : "no free cancellation"}.`,
    })),
    assumptions,
    conflictsWith: [],
  };
}

function staySource(
  selections: Array<{ options: StayOption[] }>,
  sourceKind: "estimated" | "mock" | "fallback",
  grounded: boolean,
): NonNullable<AgentProposal["source"]> {
  if (sourceKind === "fallback") {
    return {
      kind: "fallback",
      label: "Local fallback",
      freshness:
        "The model choice was unavailable; a deterministic stay selection was used from the gathered candidates.",
    };
  }
  const provenance = selections
    .flatMap(({ options }) => options.map((option) => option.provenance))
    .filter((value): value is ProviderProvenance => value !== undefined);
  if (!provenance.length) {
    return grounded
      ? {
          kind: "estimated",
          label: "Google Places estimate",
          freshness:
            "Property names, ratings and addresses are grounded; nightly price is a planning estimate, not a live quote.",
        }
      : {
          kind: "mock",
          label: "Mock booking fixture",
          freshness: "Fictional rates and availability; not a live quote.",
        };
  }
  const providers = [...new Set(provenance.map((value) => value.provider))];
  const kinds = [...new Set(provenance.map((value) => value.kind))];
  const kind: "live" | "estimated" | "mock" =
    kinds.length === 1
      ? kinds[0]!
      : kinds.includes("estimated")
        ? "estimated"
        : kinds.includes("live")
          ? "live"
          : "mock";
  const queriedAt = [...new Set(provenance.map((value) => value.queriedAt).filter(Boolean))];
  const fallback = provenance.find((value) => value.fallbackFrom);
  return {
    kind,
    label: providers.join(" + "),
    freshness: [
      `All amounts are AUD; ${kind === "live" ? "live rates" : kind === "estimated" ? "estimated prices" : "fixture prices"} can change or are not verified.`,
      queriedAt.length ? `Queried at ${queriedAt.join(", ")}.` : "",
      fallback
        ? `${fallback.fallbackFrom} was unavailable (${fallback.fallbackReason}); Google Places estimate was used.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** The grounded lodging proposal that remains correct without an LLM. */
async function buildStayProposal(
  brief: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  const evidence = await gatherStayEvidence(brief, ctx, revision);
  return assembleStayProposal(evidence, revision, (_day, options) =>
    evidence.budgetRevision ? options[0]! : chooseInitial(options),
  );
}

/**
 * What the specialist is allowed to decide: which candidate each city gets, and how to describe
 * the result. There is no money field anywhere in this schema, so a hallucinated rate has nowhere
 * to land — the cost is always computed from the candidate the model named.
 */
const StaySelection = z.object({
  choices: z
    .array(
      z.object({
        stayId: z.string().describe("The stay id, e.g. stay-1"),
        candidateId: z.string().describe("One of that stay's candidate ids, e.g. stay-1-2"),
        because: z.string().describe("One short sentence on why this candidate, for the traveller"),
      }),
    )
    .describe("One entry per stay. Every stay must be chosen."),
});
// No summary field on purpose. The proposal's summary states the authoritative total, and a free
// text field the model can write a number into is exactly the hole the id-only design closes.

/** Let the specialist choose the stay, with a safe fallback. */
async function planStays(
  brief: TripBrief,
  ctx: AgentContext,
  revision?: RevisionRequest,
): Promise<AgentProposal> {
  const model = createRoutedChatModel("accommodation");
  if (!model) return buildStayProposal(brief, ctx, revision);

  let evidence: StayEvidence | undefined;
  // The tool hands over candidates and their real rates. It does not decide.
  const search = tool(
    async () => {
      evidence = await gatherStayEvidence(brief, ctx, revision);
      return {
        stays: evidence.searched.map(({ segment, options }) => ({
          stayId: `stay-${segment.day}`,
          city: segment.city,
          checkIn: segment.checkIn,
          checkOut: segment.checkOut,
          nights: segment.nights,
          rooms: evidence!.rooms,
          candidates: options.map((option, index) => ({
            candidateId: candidateId(segment.day, index),
            name: option.name,
            area: option.area,
            rating: option.rating,
            freeCancellation: option.freeCancellation,
            totalCost: stayCost(option, segment.nights, evidence!.rooms),
          })),
        })),
      };
    },
    {
      name: "search_accommodation_candidates",
      description:
        "Search the injected booking port and return the eligible stay candidates for each city, with their ids and real total costs. It does not choose.",
      schema: z.object({}),
    },
  );
  const specialist = createAgent({
    name: "accommodation_specialist",
    model,
    tools: [search],
    systemPrompt:
      "You are the accommodation specialist. Call search_accommodation_candidates, then choose one candidate for every stay it returns. You own that choice: weigh rating, free cancellation and total cost against the traveller's brief and any revision. A budget revision means prefer the cheapest eligible candidate. Refer to candidates only by the ids you were given -- never invent a property, a rate, a rating or a policy, and never state a price yourself. Return the requested structured selection. " +
      TRAVELLER_PREFERENCES_RULE,
    responseFormat: StaySelection,
  });
  try {
    const result = await specialist.invoke({
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Choose one candidate for every stay.",
            tripId: brief.tripId,
            brief: {
              destination: brief.destination,
              dates: brief.dates,
              groupSize: brief.groupSize,
              party: brief.party,
              budgetTotal: brief.budgetTotal,
              accommodation: brief.accommodation,
              preferences: brief.preferences,
            },
            revision: revision && { reason: revision.reason, constraints: revision.constraints },
          }),
        },
      ],
    });
    const selection = readStructuredResponse("accommodation", StaySelection, result);
    if (!evidence) throw new Error("Accommodation specialist skipped its search tool.");
    const gathered = evidence;

    // A schema-valid selection still has to name candidates that exist. Resolve every stay before
    // using any of them, so a partly-understood answer falls back whole rather than mixing the
    // model's choice for one city with a heuristic for the next.
    const chosen = new Map<number, StayOption>();
    for (const { segment, options } of gathered.searched) {
      const choice = selection.choices.find((entry) => entry.stayId === `stay-${segment.day}`);
      const index = choice
        ? options.findIndex((_, i) => candidateId(segment.day, i) === choice.candidateId)
        : -1;
      if (index < 0)
        throw new Error(
          `Accommodation specialist did not choose a valid stay for ${segment.city}.`,
        );
      chosen.set(segment.day, options[index]!);
    }
    const proposal = assembleStayProposal(
      gathered,
      revision,
      (day, options) => chosen.get(day) ?? chooseInitial(options),
    );
    const because = selection.choices
      .map((entry) => entry.because?.trim())
      .filter((text): text is string => Boolean(text));
    return {
      ...proposal,
      assumptions: [...proposal.assumptions, ...because],
    };
  } catch (error) {
    ctx.signal?.throwIfAborted();
    const reason = error instanceof Error ? error.message : "unknown model error";
    console.warn(`[accommodation] Specialist failed; using a safe local plan: ${reason}`);
    if (evidence) {
      return assembleStayProposal(
        evidence,
        revision,
        (_day, options) => (evidence!.budgetRevision ? options[0]! : chooseInitial(options)),
        "fallback",
      );
    }
    const proposal = await buildStayProposal(brief, ctx, revision);
    return {
      ...proposal,
      source: {
        kind: "fallback",
        label: "Local fallback",
        freshness: "The model choice was unavailable; a deterministic stay selection was used from the gathered candidates.",
      },
    };
  }
}

// Public registry entry used by the orchestrator and revision router.
export const accommodationAgent: Specialist = {
  name: "accommodation",
  label: "Stay",
  supportsRevision: true,
  async invoke({ brief, context, revision }) {
    if (revision) {
      if (revision.tripId !== brief.tripId || revision.targetAgent !== "accommodation") {
        throw new Error("Accommodation revision must target this trip and agent.");
      }
    }
    return planStays(brief, context, revision);
  },
};
