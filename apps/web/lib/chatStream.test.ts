import { describe, expect, it } from "vitest";
import type { ChatResponse, ChatStreamEvent } from "@trip/shared";
import { readChatStream } from "./chatStream";

const result: ChatResponse = {
  reply: "Done.",
  plan: {
    tripId: "trip-1",
    planVersion: "version-1",
    brief: {
      tripId: "trip-1",
      userId: "user-1",
      destination: "Sydney",
      dates: ["2026-10-01", "2026-10-04"],
      groupSize: 1,
      budgetTotal: 1000,
    },
    round: 1,
    budgetTotal: 1000,
    estTotal: 500,
    overrunPct: -50,
    sections: [],
    hitl: [],
  },
};

describe("readChatStream", () => {
  it("handles NDJSON events split across network chunks", async () => {
    const events: ChatStreamEvent[] = [
      {
        type: "progress",
        progress: { phase: "assigning", message: "Assigned Day plan" },
      },
      { type: "result", response: result },
    ];
    const content = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
    const midpoint = Math.floor(content.length / 2);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(content.slice(0, midpoint)));
        controller.enqueue(encoder.encode(content.slice(midpoint)));
        controller.close();
      },
    });
    const phases: string[] = [];
    const response = await readChatStream(
      new Response(body, { headers: { "content-type": "application/x-ndjson" } }),
      (progress) => phases.push(progress.phase),
    );

    expect(phases).toEqual(["assigning"]);
    expect(response).toEqual(result);
  });

  it("surfaces a streamed error", async () => {
    const body = `${JSON.stringify({ type: "error", error: "Planning failed." })}\n`;
    await expect(
      readChatStream(new Response(body), () => {
        throw new Error("unexpected progress");
      }),
    ).rejects.toThrow("Planning failed.");
  });
});
