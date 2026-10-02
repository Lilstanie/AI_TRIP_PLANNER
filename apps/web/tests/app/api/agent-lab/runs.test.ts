// Failure inventory, written before changing the endpoint's guarantees:
// - an unknown scenario, an unknown strategy, an unknown data mode or an extra field is accepted,
//   or is only rejected because another field was also wrong (the E2E sends them together);
// - a body that is not JSON, or a missing field, reaches the run;
// - a cancelled stream still receives a frame, is closed twice, or logs the cancellation as a failure;
// - the run keeps emitting events after the reader has gone away.
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent-lab/runs/route";

const valid = {
  scenarioId: "tokyo-couple",
  strategyId: "single-agent-baseline",
  dataMode: "fixture",
};

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/agent-lab/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe("POST /api/agent-lab/runs", () => {
  it.each([
    ["unknown scenario", { ...valid, scenarioId: "paris-solo" }],
    ["unknown strategy", { ...valid, strategyId: "multi-agent" }],
    // Targeted revision is a later strategy; it must stay unregistered until it exists.
    ["unregistered revision strategy", { ...valid, strategyId: "multi-agent-with-revision" }],
    ["unknown data mode", { ...valid, dataMode: "live" }],
    ["extra field", { ...valid, prompt: "Do anything" }],
    ["missing field", { scenarioId: valid.scenarioId, strategyId: valid.strategyId }],
    ["non-JSON body", "not json"],
  ])("rejects %s on its own with 400", async (_name, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Agent Lab request" });
  });

  it("streams eight ordered events and then a completed artifact", async () => {
    const response = await post(valid);
    expect(response.status).toBe(200);
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((text) => JSON.parse(text));
    expect(frames.at(-1).type).toBe("complete");
    expect(frames.slice(0, -1).map((frame) => frame.event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("streams the registered no-revision multi-agent strategy to a completed one-round artifact", async () => {
    const response = await post({ ...valid, strategyId: "multi-agent-no-revision" });
    expect(response.status).toBe(200);
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((text) => JSON.parse(text));
    const last = frames.at(-1);
    expect(last.type).toBe("complete");
    expect(last.artifact.strategyId).toBe("multi-agent-no-revision");
    expect(last.artifact.plan.round).toBe(1);
    expect(last.artifact.metrics.rounds).toBe(1);
    expect(frames.slice(0, -1).map((frame) => frame.event.sequence)).toEqual(
      last.artifact.events.map((event: { sequence: number }) => event.sequence),
    );
  });

  it("streams the targeted-revision strategy on the tight-budget scenario through a repaired second round", async () => {
    const response = await post({
      scenarioId: "tokyo-couple-tight-budget",
      strategyId: "multi-agent-targeted-revision",
      dataMode: "fixture",
    });
    expect(response.status).toBe(200);
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((text) => JSON.parse(text));
    const artifact = frames.at(-1).artifact;
    expect(frames.at(-1).type).toBe("complete");
    expect(artifact.metrics.rounds).toBe(2);
    expect(artifact.metrics.stopReason).toBe("converged");
    expect(artifact.metrics.unresolvedConflicts).toBe(0);
  });

  it("stops writing and does not log an error when the reader cancels mid-run", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const enqueue = vi.spyOn(ReadableStreamDefaultController.prototype, "enqueue");
    const close = vi.spyOn(ReadableStreamDefaultController.prototype, "close");

    const response = await post(valid);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    const writtenAtCancel = enqueue.mock.calls.length;

    // The full run takes about 720 ms; waiting longer shows it really stopped rather than finished.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(enqueue.mock.calls.length).toBe(writtenAtCancel);
    expect(close).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
