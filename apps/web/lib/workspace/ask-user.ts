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
  progress?: QuestionProgress;
};

export type QuestionDraft = { selected: string[]; custom: string; skipped: boolean };

export type QuestionProgress = { index: number; drafts: QuestionDraft[] };

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
  const questions = parsed.data.questions;
  const rawProgress = "progress" in value ? value.progress : undefined;
  const progress = parseQuestionProgress(rawProgress, questions);
  return {
    key: value.key,
    questions,
    known: parsed.data.known,
    ...(parsed.data.plan ? { plan: parsed.data.plan } : {}),
    ...(progress ? { progress } : {}),
  };
}

function parseQuestionProgress(
  value: unknown,
  questions: AskUserQuestionItem[],
): QuestionProgress | undefined {
  if (!value || typeof value !== "object" || !("index" in value) || !("drafts" in value))
    return undefined;
  const progress = value as { index: unknown; drafts: unknown };
  if (
    !Number.isInteger(progress.index) ||
    (progress.index as number) < 0 ||
    (progress.index as number) >= questions.length ||
    !Array.isArray(progress.drafts) ||
    progress.drafts.length !== questions.length
  )
    return undefined;
  const drafts = progress.drafts.map((item, index) => {
    if (!item || typeof item !== "object") return undefined;
    const draft = item as { selected?: unknown; custom?: unknown; skipped?: unknown };
    const options = new Set((questions[index]?.options ?? []).map((option) => option.label));
    const selected = draft.selected;
    if (
      !Array.isArray(selected) ||
      !selected.every((label) => typeof label === "string" && options.has(label)) ||
      new Set(selected).size !== selected.length ||
      (questions[index]?.multiSelect !== true && selected.length > 1) ||
      typeof draft.custom !== "string" ||
      typeof draft.skipped !== "boolean"
    )
      return undefined;
    return { selected: draft.selected, custom: draft.custom, skipped: draft.skipped };
  });
  if (drafts.some((draft) => !draft)) return undefined;
  return { index: progress.index as number, drafts: drafts as QuestionDraft[] };
}
