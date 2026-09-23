import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionComposer } from "@/components/chat/QuestionComposer";
import { formatAskAnswers, parseRecommendedLabel, type PendingAsk } from "@/lib/workspace/ask-user";

const ask: PendingAsk = {
  key: "ask-1",
  known: { destination: "Kyoto" },
  questions: [
    {
      id: "pace",
      header: "Pace",
      question: "How busy should each day be?",
      detail: "Kyoto rewards slow mornings.",
      options: [
        { label: "Relaxed (Recommended)", description: "Two or three stops" },
        { label: "Packed", description: "Five or more stops" },
      ],
    },
    {
      id: "food",
      header: "Food",
      question: "Which food experiences matter?",
      multiSelect: true,
      options: [{ label: "Kaiseki" }, { label: "Street food" }, { label: "Cafés" }],
    },
    { id: "notes", question: "Anything else we should know?" },
  ],
};

function setup(request: PendingAsk = ask) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<QuestionComposer request={request} onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}
const title = () => screen.getByRole("heading", { level: 2 }).textContent;
const progress = () => document.querySelector(".question__progress")!.textContent;
const primary = () => document.querySelector<HTMLButtonElement>(".question__button--primary")!;

describe("QuestionComposer", () => {
  it("shows the header, numbered options with a Recommended badge, and the pager", () => {
    setup();
    expect(screen.getByText("Pace")).toBeTruthy();
    expect(title()).toBe("How busy should each day be?");
    expect(screen.getByText("Kyoto rewards slow mornings.")).toBeTruthy();
    const relaxed = screen.getByRole("radio", { name: "Relaxed" });
    expect(relaxed.textContent).toContain("1");
    expect(relaxed.textContent).toContain("Recommended");
    expect(relaxed.textContent).toContain("Two or three stops");
    expect(screen.getByRole("radio", { name: "Packed" }).textContent).toContain("2");
    expect(progress()).toBe("1 / 3");
    expect(screen.getByRole("button", { name: "Previous question" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(primary().textContent).toBe("Next");
    expect(primary().disabled).toBe(true);
  });

  it("advances on a single-select click and keeps the choice when paging back", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Packed" }));
    expect(title()).toBe("Which food experiences matter?");
    expect(progress()).toBe("2 / 3");
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByRole("radio", { name: "Packed" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(progress()).toBe("2 / 3");
  });

  it("toggles multi-select checkboxes without advancing", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Relaxed" }));
    const kaiseki = screen.getByRole("checkbox", { name: "Kaiseki" });
    fireEvent.click(kaiseki);
    fireEvent.click(screen.getByRole("checkbox", { name: "Cafés" }));
    expect(progress()).toBe("2 / 3");
    expect(kaiseki.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(kaiseki);
    expect(kaiseki.getAttribute("aria-checked")).toBe("false");
    expect(primary().disabled).toBe(false);
    fireEvent.click(primary());
    expect(progress()).toBe("3 / 3");
  });

  it("submits every answer: labels, Other text and optionless text", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Relaxed" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Street food" }));
    fireEvent.change(screen.getByLabelText("Other answer"), { target: { value: "ramen" } });
    fireEvent.click(primary());
    // The optionless question's block field takes focus.
    const notes = screen.getByLabelText("Your answer");
    expect(document.activeElement).toBe(notes);
    fireEvent.change(notes, { target: { value: "Vegetarian" } });
    expect(primary().textContent).toBe("Submit");
    fireEvent.click(primary());
    const answers = [
      { id: "pace", selected: ["Relaxed (Recommended)"] },
      { id: "food", selected: ["Street food"], custom: "ramen" },
      { id: "notes", selected: [], custom: "Vegetarian" },
    ];
    expect(onSubmit).toHaveBeenCalledWith(answers);
    expect(formatAskAnswers(ask.questions, answers)).toBe(
      "Pace: Relaxed\nFood: Street food, ramen\nAnything else we should know?: Vegetarian",
    );
  });

  it("replaces a single-select choice with Other text", () => {
    const { onSubmit } = setup({ ...ask, questions: [ask.questions[0]!] });
    fireEvent.click(screen.getByRole("radio", { name: "Packed" }));
    fireEvent.change(screen.getByLabelText("Other answer"), { target: { value: "Medium" } });
    expect(screen.getByRole("radio", { name: "Packed" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    fireEvent.click(primary());
    expect(onSubmit).toHaveBeenCalledWith([{ id: "pace", selected: [], custom: "Medium" }]);
  });

  it("skips to the next question and submits skipped ones as no preference", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Skip this question" }));
    expect(progress()).toBe("2 / 3");
    fireEvent.click(screen.getByRole("button", { name: "Skip this question" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip this question" }));
    const answers = [
      { id: "pace", selected: [] },
      { id: "food", selected: [] },
      { id: "notes", selected: [] },
    ];
    expect(onSubmit).toHaveBeenCalledWith(answers);
    expect(formatAskAnswers(ask.questions, answers)).toBe(
      "Pace: no preference\nFood: no preference\nAnything else we should know?: no preference",
    );
  });

  it("returns to an unanswered question with feedback instead of submitting", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "None" } });
    fireEvent.click(primary());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(progress()).toBe("1 / 3");
    expect(screen.getByRole("status").textContent).toBe("Please complete this question first.");
  });

  it("continues on Enter, keeps Shift+Enter and IME Enter in the field", () => {
    const { onSubmit } = setup({ ...ask, questions: [ask.questions[2]!, ask.questions[0]!] });
    const field = screen.getByLabelText("Your answer");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe(
      "Please select an option or enter a custom answer.",
    );
    fireEvent.change(field, { target: { value: "Late riser" } });
    expect(screen.getByRole("status").textContent).toBe("");
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(progress()).toBe("1 / 2");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(progress()).toBe("2 / 2");
    // Last question: a click answers without auto-advancing; Enter on an option then submits.
    const packed = screen.getByRole("radio", { name: "Packed" });
    fireEvent.click(packed);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(packed, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith([
      { id: "notes", selected: [], custom: "Late riser" },
      { id: "pace", selected: ["Packed"] },
    ]);
  });

  it("collapses to the header and dismisses with the close button", () => {
    const { onCancel } = setup();
    const toggle = screen.getByRole("button", { name: "Collapse the question card" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(title()).toBe("How busy should each day be?");
    fireEvent.click(screen.getByRole("button", { name: "Expand the question card" }));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss all questions" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("parses the Recommended suffix without changing other labels", () => {
    expect(parseRecommendedLabel("Relaxed (Recommended)")).toEqual({
      label: "Relaxed",
      recommended: true,
    });
    expect(parseRecommendedLabel("Packed")).toEqual({ label: "Packed", recommended: false });
  });
});
