import { describe, expect, it } from "vitest";
import type { AgentProgressEvent, ChatRequest } from "@trip/shared";
import { IncompleteBriefError } from "../src/chat";
import { memoryStore, ReplyOverrideModel, run } from "./chat-test-fixtures";

const request = (message: string): ChatRequest => ({
  tripId: "handoff",
  message,
  mentions: ["accommodation"],
  known: {},
});

async function turn(message: string, answer: string) {
  const events: AgentProgressEvent[] = [];
  const failure = await run(request(message), new ReplyOverrideModel(answer), memoryStore().mem, {
    onProgress: (event) => events.push(event),
  }).then(
    () => undefined,
    (error: unknown) => error as IncompleteBriefError,
  );
  const handoffs = events.flatMap((event) =>
    event.type === "decision" && event.decision.type === "mention_handoff" ? [event.decision] : [],
  );
  return { failure, handoffs };
}

describe("mention hand-off judged by the model", () => {
  it("hands off once to the specialist the model names, marked as an AI decision", async () => {
    const { failure, handoffs } = await turn("something vague", "dining");
    expect(handoffs).toEqual([
      expect.objectContaining({ from: "accommodation", to: "dining", decidedBy: "llm" }),
    ]);
    expect(failure?.assistant).toBe("dining");
  });

  it("keeps the request with the mentioned specialist when the model says own", async () => {
    const { failure, handoffs } = await turn("recommend a restaurant", "own");
    expect(handoffs).toEqual([]);
    expect(failure?.assistant).toBe("accommodation");
  });

  it("never hands off to itself", async () => {
    const { handoffs } = await turn("something vague", "accommodation");
    expect(handoffs).toEqual([]);
  });

  it("falls back to the deterministic rule when the answer is not an id", async () => {
    const { handoffs } = await turn("recommend a restaurant", "I am not sure");
    expect(handoffs).toEqual([expect.objectContaining({ to: "dining", decidedBy: "code" })]);
  });
});
