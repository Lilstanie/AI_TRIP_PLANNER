import {
  ASK_USER_MAX_OPTIONS,
  ASK_USER_MAX_QUESTIONS,
  type AskUserQuestionItem,
} from "@trip/shared";
import { z } from "zod/v4";
import { text } from "./brief-update-fields";

export const AskUserQuestionInput = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().describe("Stable id for this question; echoed in the answer."),
        question: z.string().describe("The specific question to ask the user."),
        header: z
          .string()
          .nullish()
          .describe('Optional short heading for the question, such as "Confirm" or "Choose Mode".'),
        options: z
          .array(
            z.object({
              label: z.string().describe("Short user-facing option label."),
              description: z
                .string()
                .nullish()
                .describe("One sentence explaining the tradeoff or impact."),
            }),
          )
          .nullish()
          .describe(
            'Optional choices to show the user. If you recommend one, put it first and append "(Recommended)" to that label.',
          ),
        multi_select: z
          .boolean()
          .nullish()
          .describe("Whether the user may select more than one option. Defaults to false."),
      }),
    )
    .describe("Questions to ask the user before continuing."),
});

export function toQuestions(input: z.infer<typeof AskUserQuestionInput>): AskUserQuestionItem[] {
  const ids = new Set<string>();
  const questions: AskUserQuestionItem[] = [];
  for (const raw of input.questions ?? []) {
    if (questions.length >= ASK_USER_MAX_QUESTIONS) break;
    const question = text(raw.question);
    if (!question) continue;
    let id = text(raw.id) ?? `q${questions.length + 1}`;
    while (ids.has(id)) id = `${id}-${questions.length + 1}`;
    ids.add(id);
    const options = (raw.options ?? [])
      .flatMap((option) => {
        const label = text(option?.label);
        if (!label) return [];
        const description = text(option.description);
        return [{ label, ...(description ? { description } : {}) }];
      })
      .slice(0, ASK_USER_MAX_OPTIONS);
    const header = text(raw.header);
    questions.push({
      id,
      question,
      ...(header ? { header } : {}),
      ...(options.length ? { options } : {}),
      ...(options.length && typeof raw.multi_select === "boolean"
        ? { multiSelect: raw.multi_select }
        : {}),
    });
  }
  return questions;
}

export const ASK_USER_DESCRIPTION =
  "Ask the user a concise question when you need confirmation, a choice, or missing information before proceeding. " +
  "Send one or more questions, each with a stable id that will be echoed in the answer.";
