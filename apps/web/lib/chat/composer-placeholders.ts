import type { Draft } from "@/lib/workspace/workspace";
import { firstMissingFact } from "@/lib/workspace/trip-facts";
import type { MessageKey } from "@/lib/i18n/locale";

const GAP_PROMPTS: Record<"where" | "when" | "who" | "budget", MessageKey> = {
  where: "whereAreYouHeaded",
  when: "whenDoYouWantTo",
  who: "howManyTravellers",
  budget: "whatSYourTotalBudget",
};

const GENERAL: MessageKey[] = [
  "destinationDatesTravellersAndBudget",
  "trySydneyForFourDays",
  "orNameACityAnd",
  "travellersAndBudgetHelpToo",
];

export function composerPlaceholders(draft: Draft, hasPlan: boolean): MessageKey[] {
  if (hasPlan) return ["tellMeWhatToChange"];
  const gap = firstMissingFact(draft);
  if (gap && gap in GAP_PROMPTS) {
    const primary = GAP_PROMPTS[gap as keyof typeof GAP_PROMPTS];
    return [primary, ...GENERAL.filter((item) => item !== primary)];
  }
  return [GENERAL[0]!];
}

export const PLACEHOLDER_ROTATE_MS = 4500;
