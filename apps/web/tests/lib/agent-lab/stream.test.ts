// Failure inventory, written before the module:
// - a frame split across network chunks is dropped or parsed half-way;
// - a malformed line shows the browser's raw SyntaxError text to the visitor;
// - a frame that fails the shared schema is rendered anyway;
// - an `error` frame loses the failed run artifact, so the failing sequence is never shown;
// - events recorded before the failure are not delivered;
// - the stream ends without a completion frame and the run is reported as complete;
// - a non-200 response or empty body is reported with an internal message.
import { describe, expect, it } from "vitest";
import { AgentLabRunError, readAgentLabStream } from "@/lib/agent-lab/stream";

const meta = {
  runId: "agent-lab-test",
  scenarioId: "tokyo-couple",
  strategyId: "single-agent-baseline",
  dataMode: "fixture",
} as const;

const event = (sequence: number) => ({
  type: "event",
  event: {
    ...meta,
    sequence,
    at: "2026-10-01T00:00:00.000Z",
    elapsedMs: sequence,
    event: { type: "lab_run_started", summary: "Started." },
  },
});

const failedArtifact = {
  schemaVersion: 1,
  ...meta,
  status: "failed",
  startedAt: "2026-10-01T00:00:00.000Z",
  completedAt: "2026-10-01T00:00:01.000Z",
  versions: { fixture: "tokyo-couple-v1", evaluator: "basic-plan-v1" },
  events: [event(1).event],
  failure: {
    code: "run_failed",
    message: "Unable to run this Agent Lab experiment.",
    atSequence: 1,
  },
  metrics: { eventCount: 1, durationMs: 1 },
};

function responseOf(chunks: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    init,
  );
}

const line = (frame: unknown) => `${JSON.stringify(frame)}\n`;

describe("readAgentLabStream", () => {
  it("reassembles a frame that arrives in two chunks", async () => {
    const text = line(event(1));
    const seen: number[] = [];
    await expect(
      readAgentLabStream(responseOf([text.slice(0, 40), text.slice(40)]), (e) =>
        seen.push(e.sequence),
      ),
    ).rejects.toThrow(/without a completed/);
    expect(seen).toEqual([1]);
  });

  it("delivers earlier events and keeps the failed artifact from an error frame", async () => {
    const seen: number[] = [];
    const error = await readAgentLabStream(
      responseOf([
        line(event(1)),
        line({
          type: "error",
          error: "Unable to run this Agent Lab experiment.",
          artifact: failedArtifact,
        }),
      ]),
      (e) => seen.push(e.sequence),
    ).catch((caught) => caught);
    expect(seen).toEqual([1]);
    expect(error).toBeInstanceOf(AgentLabRunError);
    expect(error.artifact.failure.atSequence).toBe(1);
  });

  it("reports a malformed line in plain words, not as a SyntaxError", async () => {
    const error = await readAgentLabStream(responseOf(["{not json\n"]), () => {}).catch((c) => c);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).not.toBe("SyntaxError");
    expect(error.message).toMatch(/invalid event/i);
  });

  it("rejects a frame that fails the shared schema", async () => {
    const error = await readAgentLabStream(
      responseOf([line({ type: "event", event: { sequence: 0 } })]),
      () => {},
    ).catch((c) => c);
    expect(error.message).toMatch(/invalid event/i);
  });

  it("does not report a stream with no completion frame as complete", async () => {
    await expect(readAgentLabStream(responseOf([line(event(1))]), () => {})).rejects.toThrow(
      /without a completed/,
    );
  });

  it("reports a failed start without internal detail", async () => {
    await expect(readAgentLabStream(responseOf([], { status: 500 }), () => {})).rejects.toThrow(
      "Unable to start this experiment.",
    );
  });
});
