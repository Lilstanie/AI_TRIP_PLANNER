import { describe, expect, it } from "vitest";
import { ChatStreamEvent } from "./telemetry";

describe("chat run telemetry contracts", () => {
  it("accepts unavailable provider usage without inventing tokens", () => {
    const event = ChatStreamEvent.parse({
      type: "progress",
      progress: {
        phase: "running",
        message: "Day plan is preparing its proposal",
        agent: {
          id: "itinerary",
          label: "Day plan",
          status: "running",
          model: "DeepSeek · deepseek-v4-flash",
          usage: null,
        },
      },
    });

    expect(event.type).toBe("progress");
    if (event.type === "progress") expect(event.progress.agent?.usage).toBeNull();
  });

  it("rejects invalid token counts", () => {
    expect(() =>
      ChatStreamEvent.parse({
        type: "progress",
        progress: {
          phase: "running",
          message: "Planning",
          agent: {
            id: "itinerary",
            label: "Day plan",
            status: "running",
            model: "model",
            usage: { inputTokens: -1, outputTokens: 1, totalTokens: 0 },
          },
        },
      }),
    ).toThrow();
  });
});
