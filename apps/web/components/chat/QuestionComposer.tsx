"use client";
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  parseRecommendedLabel,
  type PendingAsk,
  type QuestionAnswer,
} from "@/lib/workspace/ask-user";

/*
 * The structured-question card that takes the composer's seat while the coordinator waits for an
 * answer. Behaviour, layout and copy follow DeepSeek Harness's QuestionFlow
 * (ui-user-questions QuestionComposer.tsx); the glyphs are its 14/16px outline icons.
 */

const copy = {
  incomplete: "Please complete this question first.",
  unanswered: "Please select an option or enter a custom answer.",
  prev: "Previous question",
  next: "Next question",
  minimize: "Collapse the question card",
  maximize: "Expand the question card",
  cancel: "Dismiss all questions",
  recommended: "Recommended",
  placeholder: "Type your answer",
  skip: "Skip this question",
  advance: "Next",
  submit: "Submit",
} as const;

type Feedback = "incomplete" | "unanswered";

/** One in-progress answer, including an explicit skip. */
type Draft = { selected: string[]; custom: string; skipped: boolean };

type IconProps = { size?: number };

function IconChevronDown({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconChevronUp({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.15137 8.5L2.57617 8.07617L5.30273 5.34863C5.55843 5.09294 5.78438 4.86618 5.98828 4.70215C6.20088 4.53117 6.44405 4.38244 6.75 4.33398C6.91565 4.30778 7.08435 4.30778 7.25 4.33398C7.55595 4.38244 7.79912 4.53117 8.01172 4.70215C8.21561 4.86618 8.44157 5.09294 8.69727 5.34863L11.4238 8.07617L11.8486 8.5L11 9.34863L10.5762 8.92383L7.84863 6.19727C7.57405 5.92269 7.40124 5.75152 7.25977 5.6377C7.12709 5.53096 7.07728 5.52187 7.0625 5.51953C7.02105 5.51297 6.97895 5.51297 6.9375 5.51953C6.92272 5.52187 6.87291 5.53096 6.74023 5.6377C6.59876 5.75152 6.42595 5.92268 6.15137 6.19727L3.42383 8.92383L3 9.34863L2.15137 8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconChevronLeft({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M8.5 2.15137L8.07617 2.57617L5.34863 5.30273C5.09294 5.55843 4.86618 5.78438 4.70215 5.98828C4.53117 6.20088 4.38244 6.44405 4.33398 6.75C4.30778 6.91565 4.30778 7.08435 4.33398 7.25C4.38244 7.55595 4.53117 7.79912 4.70215 8.01172C4.86618 8.21561 5.09294 8.44157 5.34863 8.69727L8.07617 11.4238L8.5 11.8486L9.34863 11L8.92383 10.5762L6.19727 7.84863C5.92268 7.57405 5.75151 7.40124 5.6377 7.25977C5.53096 7.12709 5.52187 7.07728 5.51953 7.0625C5.51297 7.02105 5.51297 6.97895 5.51953 6.9375C5.52187 6.92272 5.53096 6.87291 5.6377 6.74023C5.75152 6.59876 5.92268 6.42595 6.19727 6.15137L8.92383 3.42383L9.34863 3L8.5 2.15137Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconChevronRight({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.5 2.15137L5.92383 2.57617L8.65137 5.30273C8.90706 5.55843 9.13382 5.78438 9.29785 5.98828C9.46883 6.20088 9.61756 6.44405 9.66602 6.75C9.69222 6.91565 9.69222 7.08435 9.66602 7.25C9.61756 7.55595 9.46883 7.79912 9.29785 8.01172C9.13382 8.21561 8.90706 8.44157 8.65137 8.69727L5.92383 11.4238L5.5 11.8486L4.65137 11L5.07617 10.5762L7.80273 7.84863C8.07732 7.57405 8.24849 7.40124 8.3623 7.25977C8.46904 7.12709 8.47813 7.07728 8.48047 7.0625C8.48703 7.02105 8.48703 6.97895 8.48047 6.9375C8.47813 6.92272 8.46904 6.87291 8.3623 6.74023C8.24848 6.59876 8.07732 6.42595 7.80273 6.15137L5.07617 3.42383L4.65137 3L5.5 2.15137Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconClose({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14.1168 13.197L13.197 14.1167L1.8833 2.80303L2.80309 1.88324L14.1168 13.197Z"
        fill="currentColor"
      />
      <path
        d="M13.197 1.88326L14.1168 2.80305L2.80309 14.1168L1.8833 13.197L13.197 1.88326Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconEdit({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.94076 1.34942C10.7047 0.90231 11.6503 0.902415 12.4143 1.34942C12.7061 1.52015 12.9688 1.79118 13.3104 2.13284C13.6521 2.47448 13.9231 2.73721 14.0939 3.02894C14.5408 3.79294 14.5409 4.73856 14.0939 5.50251C13.9231 5.79415 13.652 6.05704 13.3104 6.39861L6.65932 13.0497C6.28068 13.4284 6.00695 13.7108 5.66543 13.9097C5.32391 14.1085 4.94315 14.2074 4.42705 14.3498L3.24394 14.6761C2.77527 14.8054 2.34538 14.9262 2.00131 14.9684C1.65196 15.0112 1.17964 15.0013 0.810764 14.6325C0.441921 14.2637 0.432107 13.7913 0.47486 13.442C0.517035 13.0979 0.6379 12.668 0.767181 12.1993L1.09352 11.0162C1.23588 10.5001 1.33481 10.1193 1.5336 9.77784C1.7325 9.43632 2.0149 9.1626 2.39355 8.78395L9.04466 2.13284C9.38625 1.79126 9.64911 1.52016 9.94076 1.34942ZM15.5427 14.8398H7.55223L8.96707 13.425H15.5427V14.8398ZM3.39382 9.78422C2.965 10.213 2.84244 10.3436 2.75709 10.49C2.67183 10.6366 2.61862 10.8079 2.45733 11.3925L2.13099 12.5756C2.00183 13.0439 1.92194 13.3419 1.88863 13.5536C2.10041 13.5204 2.39872 13.4416 2.86764 13.3123L4.05075 12.9859C4.63544 12.8246 4.80669 12.7715 4.95323 12.6862C5.09968 12.6008 5.23022 12.4783 5.65905 12.0494L10.721 6.98644L8.45577 4.72121L3.39382 9.78422ZM11.7 2.57079C11.3774 2.38198 10.9777 2.38198 10.6551 2.57079C10.5602 2.62647 10.4487 2.72931 10.0449 3.13311L9.45604 3.72094L11.7213 5.98617L12.3102 5.39833C12.7139 4.99457 12.8168 4.88307 12.8725 4.78818C13.0613 4.46561 13.0612 4.06585 12.8725 3.74326C12.8169 3.64827 12.7146 3.53752 12.3102 3.13311C11.9057 2.72863 11.795 2.6264 11.7 2.57079Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconCheck({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M11.5635 4.58984L7.61426 9.07715C7.35154 9.37561 7.11346 9.64812 6.89453 9.84668C6.66593 10.054 6.38519 10.2506 6.01465 10.3164C5.82079 10.3508 5.62207 10.3529 5.42773 10.3213C5.0561 10.2609 4.77266 10.0674 4.54102 9.86328C4.31926 9.66791 4.07752 9.39911 3.81055 9.10449L2.44531 7.59863L3.55664 6.59082L4.92188 8.09766C5.21256 8.41844 5.38878 8.61191 5.53223 8.73828C5.61022 8.80699 5.65253 8.83192 5.66895 8.83984C5.69648 8.84429 5.72449 8.84467 5.75195 8.83984C5.72657 8.84451 5.75564 8.85422 5.88672 8.73535C6.02833 8.60692 6.20225 8.41088 6.48828 8.08594L10.4385 3.59961L11.5635 4.58984Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Return whether a text-field key event belongs to an active IME composition. */
function isComposing(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  // keyCode 229 is the legacy IME-composition signal engines emit without isComposing.
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
}

/**
 * Auto-growing free-text answer: a textarea over a hidden mirror that owns the height. The mirror
 * renders the draft plus a trailing newline in normal flow and so sizes the shared grid cell
 * (soft wraps included); `rows={1}` keeps the textarea's own intrinsic height out of the sizing.
 * Mirror and textarea must share font, line-height, padding and wrapping rules.
 */
function AnswerField(props: {
  variant: "inline" | "block";
  value: string;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div
      className={`question__field ${props.variant === "inline" ? "question__custom-inline" : "question__custom-block"}`}
    >
      <div aria-hidden className="question__field-mirror">{`${props.value}\n`}</div>
      <textarea
        autoFocus={props.autoFocus}
        className="question__field-input"
        aria-label={props.label}
        value={props.value}
        rows={1}
        placeholder={props.placeholder}
        onFocus={props.onFocus}
        onChange={props.onChange}
        onKeyDown={props.onKeyDown}
      />
    </div>
  );
}

const answered = (item: Draft) => item.selected.length > 0 || item.custom.trim() !== "";
const completed = (item: Draft) => answered(item) || item.skipped;

/**
 * The question card. Mount it with `key={request.key}` so a new ask starts with fresh drafts.
 * @param props.request - the pending ask and its 1–4 questions.
 * @param props.onSubmit - receives one answer per question once every question is answered or skipped.
 * @param props.onCancel - dismisses the whole ask.
 */
export function QuestionComposer({
  request,
  onSubmit,
  onCancel,
}: {
  request: PendingAsk;
  onSubmit: (answers: QuestionAnswer[]) => void;
  onCancel: () => void;
}) {
  const questions = request.questions;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    questions.map(() => ({ selected: [], custom: "", skipped: false })),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // Collapsed to the header strip so the conversation above stays readable.
  const [minimized, setMinimized] = useState(false);
  // The free-form textarea autofocuses on first presentation only; re-expanding must not steal
  // focus from the toggle, so focus is granted once per question index.
  const focusedQuestions = useRef(new Set<number>());
  const question = questions[index]!;
  const draft = drafts[index]!;
  const multi = question.multiSelect === true;
  const hasOptions = (question.options?.length ?? 0) > 0;
  const last = index === questions.length - 1;
  const titleId = `question-${request.key}-${index}`;

  const replaceProgress = (nextIndex: number, nextDrafts: Draft[]) => {
    setIndex(nextIndex);
    setDrafts(nextDrafts);
  };

  const updateDraft = (update: (current: Draft) => Draft, nextIndex = index) => {
    replaceProgress(
      nextIndex,
      drafts.map((item, itemIndex) => (itemIndex === index ? update(item) : item)),
    );
    setFeedback(null);
  };

  const choose = (label: string) => {
    updateDraft(
      (current) => {
        if (multi) {
          const selected = current.selected.includes(label)
            ? current.selected.filter((item) => item !== label)
            : [...current.selected, label];
          return { ...current, selected, skipped: false };
        }
        return { selected: [label], custom: "", skipped: false };
      },
      !multi && !last ? index + 1 : index,
    );
  };

  const submitDrafts = (values: Draft[]) => {
    const missing = values.findIndex((item) => !completed(item));
    if (missing >= 0) {
      replaceProgress(missing, values);
      setFeedback("incomplete");
      return;
    }
    onSubmit(
      questions.map((item, itemIndex) => {
        const value = values[itemIndex]!;
        if (value.skipped) return { id: item.id, selected: [] };
        const custom = value.custom.trim();
        return {
          id: item.id,
          selected: custom === "" || item.multiSelect === true ? value.selected : [],
          ...(custom === "" ? {} : { custom }),
        };
      }),
    );
  };

  const continueFlow = () => {
    if (!answered(draft)) {
      setFeedback("unanswered");
      return;
    }
    if (!last) {
      replaceProgress(index + 1, drafts);
      setFeedback(null);
      return;
    }
    submitDrafts(drafts);
  };

  // A multi-select draft keeps its checked labels; a single-select custom answer replaces the
  // selection. Enter continues the flow, Shift+Enter breaks a line.
  const draftCustom = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    updateDraft((current) => ({
      ...current,
      selected: multi ? current.selected : [],
      custom: value,
      skipped: false,
    }));
  };

  const continueFromCustom = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing(event)) return;
    event.preventDefault();
    continueFlow();
  };

  const skipQuestion = () => {
    const nextDrafts = drafts.map((item, itemIndex) =>
      itemIndex === index ? { selected: [], custom: "", skipped: true } : item,
    );
    replaceProgress(last ? index : index + 1, nextDrafts);
    setFeedback(null);
    if (last) submitDrafts(nextDrafts);
  };

  return (
    <div className="question" data-question-key={request.key}>
      <section
        className={`question__card${minimized ? " question__card--minimized" : ""}`}
        aria-labelledby={titleId}
      >
        <header className="question__header">
          <div className="question__heading">
            {question.header !== undefined && (
              <div className="question__eyebrow">{question.header}</div>
            )}
            <h2 className="question__title" id={titleId}>
              {question.question}
            </h2>
          </div>
          <div className="question__header-actions">
            <button
              type="button"
              className="question__icon-button"
              aria-label={minimized ? copy.maximize : copy.minimize}
              title={minimized ? copy.maximize : copy.minimize}
              aria-expanded={!minimized}
              onClick={() => setMinimized((current) => !current)}
            >
              {minimized ? <IconChevronUp /> : <IconChevronDown />}
            </button>
            <button
              type="button"
              className="question__icon-button"
              aria-label={copy.cancel}
              title={copy.cancel}
              onClick={onCancel}
            >
              <IconClose />
            </button>
          </div>
        </header>

        {!minimized && (
          <>
            <div className="question__body">
              {question.detail !== undefined && (
                <p className="question__detail">{question.detail}</p>
              )}
              <div className="question__options" role={multi ? "group" : "radiogroup"}>
                {(question.options ?? []).map((option, optionIndex) => {
                  const selected = draft.selected.includes(option.label);
                  const display = parseRecommendedLabel(option.label);
                  return (
                    <button
                      type="button"
                      key={`${option.label}-${optionIndex}`}
                      className={`question__option${selected && !multi ? " question__option--selected" : ""}`}
                      role={multi ? "checkbox" : "radio"}
                      aria-checked={selected}
                      aria-label={display.label}
                      onClick={() => choose(option.label)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || !drafts.every(completed)) return;
                        event.preventDefault();
                        submitDrafts(drafts);
                      }}
                    >
                      {multi ? (
                        <span
                          className={`question__checkbox${selected ? " question__checkbox--checked" : ""}`}
                          aria-hidden="true"
                        >
                          {selected && <IconCheck size={12} />}
                        </span>
                      ) : (
                        <span className="question__number">{optionIndex + 1}</span>
                      )}
                      <span className="question__option-copy">
                        <span className="question__option-line">
                          <span className="question__option-label">{display.label}</span>
                          {option.description !== undefined && (
                            <span className="question__description">{option.description}</span>
                          )}
                          {display.recommended && (
                            <span className="question__badge">{copy.recommended}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}

                {hasOptions ? (
                  <div
                    className={`question__custom-row${draft.custom !== "" ? " question__custom-row--active" : ""}`}
                  >
                    {multi ? (
                      <span
                        className={`question__checkbox${draft.custom !== "" ? " question__checkbox--checked" : ""}`}
                        aria-hidden="true"
                      >
                        {draft.custom !== "" && <IconCheck size={12} />}
                      </span>
                    ) : (
                      <span className="question__number" aria-hidden="true">
                        <IconEdit size={12} />
                      </span>
                    )}
                    <AnswerField
                      variant="inline"
                      value={draft.custom}
                      label="Other answer"
                      placeholder={copy.placeholder}
                      onChange={draftCustom}
                      onKeyDown={continueFromCustom}
                    />
                  </div>
                ) : (
                  <AnswerField
                    key={index}
                    autoFocus={!focusedQuestions.current.has(index)}
                    variant="block"
                    value={draft.custom}
                    label="Your answer"
                    placeholder={copy.placeholder}
                    onFocus={() => focusedQuestions.current.add(index)}
                    onChange={draftCustom}
                    onKeyDown={continueFromCustom}
                  />
                )}
              </div>
            </div>

            <footer className="question__footer">
              <div className="question__pager">
                <button
                  type="button"
                  className="question__icon-button"
                  aria-label={copy.prev}
                  disabled={index === 0}
                  onClick={() => {
                    replaceProgress(index - 1, drafts);
                    setFeedback(null);
                  }}
                >
                  <IconChevronLeft />
                </button>
                <span className="question__progress">
                  {index + 1} / {questions.length}
                </span>
                <button
                  type="button"
                  className="question__icon-button"
                  aria-label={copy.next}
                  disabled={last}
                  onClick={() => {
                    replaceProgress(index + 1, drafts);
                    setFeedback(null);
                  }}
                >
                  <IconChevronRight />
                </button>
              </div>
              <div className="question__feedback" role="status">
                {feedback === null ? null : copy[feedback]}
              </div>
              <div className="question__footer-actions">
                <button
                  type="button"
                  className="question__button question__button--outline"
                  onClick={skipQuestion}
                >
                  {copy.skip}
                </button>
                <button
                  type="button"
                  className="question__button question__button--primary"
                  disabled={!answered(draft)}
                  onClick={continueFlow}
                >
                  {last ? copy.submit : copy.advance}
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
