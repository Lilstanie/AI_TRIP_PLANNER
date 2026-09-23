import type { AskUserQuestionItem, PartialTripBrief, TripPlan } from "@trip/shared";

/**
 * A structured question the coordinator asked and the traveller has not answered yet. It lives
 * only in memory: a reload drops it, and the question text stays in the assistant message.
 */
export type PendingAsk = {
  /** Identifies this ask, so a newer one starts the answer drafts afresh. */
  key: string;
  questions: AskUserQuestionItem[];
  /** What the coordinator already understood; travels back with the answer. */
  known: PartialTripBrief;
  /** The plan the question was asked about, returned unchanged by the server. */
  plan?: TripPlan;
};

/** The traveller's answer to one question. `selected` empty and no `custom` means skipped. */
export type QuestionAnswer = {
  id: string;
  /** Offered labels, exactly as the coordinator sent them. */
  selected: string[];
  custom?: string;
};

const RECOMMENDED_SUFFIX = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i;

/**
 * Split the conventional " (Recommended)" suffix off an option label.
 * @param label - the option label as the coordinator sent it.
 * @returns the label to display and whether it carried the suffix.
 */
export function parseRecommendedLabel(label: string): { label: string; recommended: boolean } {
  return RECOMMENDED_SUFFIX.test(label)
    ? { label: label.replace(RECOMMENDED_SUFFIX, ""), recommended: true }
    : { label, recommended: false };
}

/**
 * Turn the answers into the traveller's next chat message: one line per question, named by its
 * header (or the question itself), with the chosen labels and any typed text. A skipped question
 * reads "no preference" so the coordinator knows it was seen.
 */
export function formatAskAnswers(
  questions: readonly AskUserQuestionItem[],
  answers: readonly QuestionAnswer[],
): string {
  return questions
    .map((question) => {
      const answer = answers.find((item) => item.id === question.id);
      const parts = [
        ...(answer?.selected ?? []).map((label) => parseRecommendedLabel(label).label),
        ...(answer?.custom?.trim() ? [answer.custom.trim()] : []),
      ];
      const name = question.header?.trim() || question.question;
      return `${name}: ${parts.length ? parts.join(", ") : "no preference"}`;
    })
    .join("\n");
}
