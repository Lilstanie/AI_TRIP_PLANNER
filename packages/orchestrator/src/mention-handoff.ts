import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AGENT_NAMES, type AgentName } from "@trip/shared";

export interface Handoff {
  to: AgentName;
  decidedBy: "llm" | "code";
}

const TOPICS: Record<AgentName, RegExp> = {
  dining: /\b(restaurants?|eat|eating|food|dinner|lunch|breakfast|cafes?|brunch)\b|餐|吃|美食/i,
  accommodation: /\b(hotels?|hostels?|airbnb|rooms?|lodging|accommodation)\b|酒店|住宿|民宿|旅馆/i,
  transport:
    /\b(flights?|trains?|buses|bus|taxis?|metro|subway|transport|transit|airport)\b|机票|航班|火车|地铁|交通/i,
  "destination-guide":
    /\b(attractions?|sightseeing|museums?|landmarks?|sights)\b|景点|景区|博物馆|地标/i,
  itinerary: /\b(itinerary|schedule|day plan)\b|行程|日程/i,
};

export function ruleHandoff(message: string, mentioned: AgentName): Handoff | undefined {
  const request = message.replace(/@\S+/g, " ");
  const matched = AGENT_NAMES.filter((agent) => TOPICS[agent].test(request));
  if (matched.includes(mentioned)) return undefined;
  return matched.length === 1 ? { to: matched[0]!, decidedBy: "code" } : undefined;
}

export async function judgeHandoff(
  message: string,
  mentioned: AgentName,
  model: BaseChatModel | undefined,
): Promise<Handoff | undefined> {
  if (!model) return ruleHandoff(message, mentioned);
  try {
    const result = await model.invoke([
      [
        "system",
        `You are the ${mentioned} specialist of a trip planner. Decide whether the traveller's request belongs to you. Answer with exactly one word: "own" if it is yours, otherwise the id of the specialist it belongs to, one of ${AGENT_NAMES.join(", ")}.`,
      ],
      ["human", message],
    ]);
    const answer = typeof result.content === "string" ? result.content.trim().toLowerCase() : "";
    if (answer === "own") return undefined;
    const to = AGENT_NAMES.find((agent) => agent === answer);
    if (to) return to === mentioned ? undefined : { to, decidedBy: "llm" };
  } catch {
    return ruleHandoff(message, mentioned);
  }
  return ruleHandoff(message, mentioned);
}
