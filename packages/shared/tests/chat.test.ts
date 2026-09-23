import { describe, expect, it } from "vitest";
import {
  AgentProgressEvent,
  ASK_USER_MAX_OPTIONS,
  ASK_USER_MAX_QUESTIONS,
  AskUserQuestionItem,
  ChatAskUser,
  ToolResultRow,
} from "../src/chat";

const question = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  question: `Question ${id}?`,
  ...extra,
});

describe("structured questions", () => {
  it("accepts a DSH-shaped question with choices", () => {
    const parsed = AskUserQuestionItem.parse(
      question("pace", {
        header: "Pace",
        detail: "Affects how many sights fit into a day.",
        options: [
          { label: "Relaxed (Recommended)", description: "Two sights a day." },
          { label: "Packed" },
        ],
        multiSelect: false,
      }),
    );
    expect(parsed.options?.[0]?.label).toBe("Relaxed (Recommended)");
  });

  it("accepts a free-text question with no options", () => {
    expect(AskUserQuestionItem.safeParse(question("free")).success).toBe(true);
  });

  it("refuses a blank question, a blank option label and too many options", () => {
    expect(AskUserQuestionItem.safeParse({ id: "q", question: "  " }).success).toBe(false);
    expect(
      AskUserQuestionItem.safeParse(question("q", { options: [{ label: " " }] })).success,
    ).toBe(false);
    const options = Array.from({ length: ASK_USER_MAX_OPTIONS + 1 }, (_v, i) => ({
      label: `Option ${i}`,
    }));
    expect(AskUserQuestionItem.safeParse(question("q", { options })).success).toBe(false);
  });

  it("carries one to four questions and what is known", () => {
    const frame = (count: number) => ({
      type: "ask_user",
      questions: Array.from({ length: count }, (_v, i) => question(`q${i}`)),
      known: { destination: "Tokyo" },
    });
    expect(ChatAskUser.safeParse(frame(1)).success).toBe(true);
    expect(ChatAskUser.safeParse(frame(ASK_USER_MAX_QUESTIONS)).success).toBe(true);
    expect(ChatAskUser.safeParse(frame(0)).success).toBe(false);
    expect(ChatAskUser.safeParse(frame(ASK_USER_MAX_QUESTIONS + 1)).success).toBe(false);
  });
});

describe("result row kind", () => {
  it("is optional, so rows from older emitters still parse", () => {
    expect(ToolResultRow.safeParse({ label: "Opera House" }).success).toBe(true);
    expect(ToolResultRow.safeParse({ label: "Opera House", kind: "attraction" }).success).toBe(
      true,
    );
    expect(ToolResultRow.safeParse({ label: "Opera House", kind: "castle" }).success).toBe(false);
  });

  it("carries the row's own web page, and only a real URL", () => {
    expect(
      ToolResultRow.safeParse({ label: "Harbour Hotel", url: "https://harbourhotel.example/" })
        .success,
    ).toBe(true);
    // Absent for a provider that reported no page; never a bare host or a
    // fragment a client would have to repair.
    expect(ToolResultRow.safeParse({ label: "Harbour Hotel" }).success).toBe(true);
    expect(ToolResultRow.safeParse({ label: "Harbour Hotel", url: "harbourhotel" }).success).toBe(
      false,
    );
  });

  it("travels inside a completed tool event", () => {
    const parsed = AgentProgressEvent.parse({
      type: "tool_completed",
      agent: "itinerary",
      round: 1,
      callId: "itinerary:1:1",
      tool: "booking.searchStays",
      label: "Search stays",
      resultSummary: "1 stay option",
      resultRows: [
        { label: "Harbour Hotel", kind: "stay", url: "https://harbourhotel.example/rooms" },
      ],
    });
    expect(parsed.type === "tool_completed" && parsed.resultRows?.[0]?.kind).toBe("stay");
    expect(parsed.type === "tool_completed" && parsed.resultRows?.[0]?.url).toBe(
      "https://harbourhotel.example/rooms",
    );
  });
});
