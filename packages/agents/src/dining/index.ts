// Owner: D — DiningAgent.
// Reference implementation of an LLM-backed agent: it asks @trip/llm for cuisine
// picks, and if the (free-tier, flaky) model call fails or returns junk it falls
// back to the deterministic stub. A failed LLM call degrades this section, it
// never crashes the plan. Copy this shape into the other agents — see docs/graph.md.

import type { Agent, AgentProposal, TripBrief, AgentContext } from "@trip/shared";
import { chatJsonOrNull } from "@trip/llm";

interface DiningPicks {
  picks: { name: string; cuisine?: string; note?: string }[];
}

export const diningAgent: Agent = {
  name: "dining",
  label: "Things to do",

  async run(brief: TripBrief, ctx: AgentContext): Promise<AgentProposal> {
    ctx.signal?.throwIfAborted();

    // dietary preferences live in long-term memory (E writes them from the filters)
    const prefs = await ctx.mem.getLongTerm(brief.userId);
    const diet = prefs.find((p) => p.key === "diet")?.value;

    const llm = await chatJsonOrNull<DiningPicks>(
      [
        {
          role: "system",
          content:
            "You recommend restaurants for a trip. Reply with ONLY minified JSON: " +
            '{"picks":[{"name":string,"cuisine":string,"note":string}]}. 3 to 5 picks.',
        },
        {
          role: "user",
          content:
            `Destination: ${brief.destination}. Group of ${brief.groupSize}. ` +
            `Dates ${brief.dates[0]}..${brief.dates[1]}.` +
            (diet ? ` Dietary requirement: ${diet}.` : ""),
        },
      ],
      { signal: ctx.signal, maxTokens: 400 },
    );

    if (llm?.picks?.length) {
      return {
        agent: "dining",
        summary: `${llm.picks.length} food picks for ${brief.destination}`,
        items: llm.picks.slice(0, 5).map((pick) => ({
          kind: "meal",
          detail: `${pick.name}${pick.cuisine ? ` — ${pick.cuisine}` : ""}${pick.note ? `: ${pick.note}` : ""}`,
          estCost: 0, // dining is advisory; it does not add to the budget
        })),
        assumptions: [
          "Dining picks are LLM-generated suggestions, not reservations.",
          diet ? `Filtered for dietary requirement: ${diet}.` : "No dietary requirement on file.",
        ],
        conflictsWith: [],
      };
    }

    // --- fallback: LLM unavailable / unusable ---------------------------------
    return {
      agent: "dining",
      summary: `Food picks for ${brief.destination} — offline fallback`,
      items: [
        {
          kind: "meal",
          detail: `Explore ${brief.destination}'s local specialities near the day's activities.`,
          estCost: 0,
        },
      ],
      assumptions: [
        "LLM dining suggestions were unavailable; showing a generic note.",
        diet ? `Dietary requirement on file: ${diet}.` : "No dietary requirement on file.",
      ],
      conflictsWith: [],
    };
  },
};
