import {
  ChatAskUser,
  type AskUserQuestionItem,
  type PartialTripBrief,
  type TripPlan,
} from "@trip/shared";

export type PendingAsk = {
  key: string;
  questions: AskUserQuestionItem[];

  known: PartialTripBrief;

  plan?: TripPlan;
};

export type QuestionAnswer = {
  id: string;

  selected: string[];
  custom?: string;
};

const RECOMMENDED_SUFFIX = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i;

export function parseRecommendedLabel(label: string): { label: string; recommended: boolean } {
  return RECOMMENDED_SUFFIX.test(label)
    ? { label: label.replace(RECOMMENDED_SUFFIX, ""), recommended: true }
    : { label, recommended: false };
}

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

export function parsePendingAsk(value: unknown): PendingAsk | undefined {
  if (!value || typeof value !== "object" || !("key" in value) || typeof value.key !== "string")
    return undefined;
  const parsed = ChatAskUser.safeParse({ ...value, type: "ask_user" });
  if (!parsed.success) return undefined;
  return {
    key: value.key,
    questions: parsed.data.questions,
    known: parsed.data.known,
    ...(parsed.data.plan ? { plan: parsed.data.plan } : {}),
  };
}
