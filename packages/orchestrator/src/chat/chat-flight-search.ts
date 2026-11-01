import type { FlightAnswer, InterfaceLanguage } from "@trip/shared";
import { tool } from "langchain";
import { z } from "zod/v4";
import { ISO_DATE } from "./brief";
import type { FlightQuery } from "./flight-query";

export type FlightSearch = (query: FlightQuery) => Promise<FlightAnswer>;

export class FlightAnswerReady extends Error {
  constructor(readonly answer: FlightAnswer) {
    super(answer.reply);
    this.name = "FlightAnswerReady";
  }
}

const FlightSearchInput = z.object({
  from: z.string().describe("departure city, as a name or a three-letter airport code"),
  to: z.string().describe("arrival city, as a name or a three-letter airport code"),
  depart: z.string().regex(ISO_DATE).describe("YYYY-MM-DD"),
  return: z.string().regex(ISO_DATE).optional().describe("YYYY-MM-DD, for a return trip"),
  passengers: z.number().int().positive().optional(),
});

export function createFlightSearchTool(
  flightSearch: FlightSearch,
  context: {
    groupSize(): number | undefined;
    language: InterfaceLanguage;
    onAnswer(answer: FlightAnswer): void;
  },
) {
  return tool(
    async (input: z.infer<typeof FlightSearchInput>) => {
      try {
        const answer = await flightSearch({
          from: input.from,
          to: input.to,
          depart: input.depart,
          ...(input.return ? { return: input.return } : {}),
          passengers: input.passengers ?? context.groupSize() ?? 1,
          cheapestFirst: false,
          language: context.language,
        });
        context.onAnswer(answer);
        return {
          ok: true as const,
          fares: answer.options.length,
          note: "The traveller now sees these fares as cards. End your turn with at most one short sentence.",
        };
      } catch (error) {
        return {
          ok: false as const,
          reason: error instanceof Error ? error.message : "The flight search failed.",
        };
      }
    },
    {
      name: "search_flights",
      description:
        "Search real flight fares for a route and dates and show them to the traveller as cards. Does not change the trip or the plan.",
      schema: FlightSearchInput,
    },
  );
}
