import type { Draft } from "@/lib/workspace/workspace";
import { firstMissingFact } from "@/lib/workspace/trip-facts";
import type { MessageKey } from "@/lib/i18n/locale";

const GAP_PROMPTS: Record<"where" | "when" | "who" | "budget", MessageKey> = {
  where: "Where are you headed?",
  when: "When do you want to go?",
  who: "How many travellers?",
  budget: "What's your total budget?",
};

const GENERAL: MessageKey[] = [
  "Destination, dates, travellers and budget…",
  "Try: Sydney for four days…",
  "Or name a city and your dates…",
  "Travellers and budget help too…",
];

export function composerPlaceholders(draft: Draft, hasPlan: boolean): MessageKey[] {
  if (hasPlan) return ["Tell me what to change…"];
  const gap = firstMissingFact(draft);
  if (gap && gap in GAP_PROMPTS) {
    const primary = GAP_PROMPTS[gap as keyof typeof GAP_PROMPTS];
    return [primary, ...GENERAL.filter((item) => item !== primary)];
  }
  return GENERAL;
}

export const PLACEHOLDER_ROTATE_MS = 4500;
