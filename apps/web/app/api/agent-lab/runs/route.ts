import { createFailedAgentLabArtifact, runAgentLab } from "@trip/orchestrator";
import {
  AgentLabRunRequest,
  AgentLabStreamFrame,
  type AgentLabRunEvent,
  type AgentLabStreamFrame as AgentLabStreamFrameValue,
} from "@trip/shared";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = AgentLabRunRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Agent Lab request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const runId = `agent-lab-${crypto.randomUUID()}`;
  const startedAtMs = Date.now();
  const events: AgentLabRunEvent[] = [];
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
      abortController.abort(new DOMException("Agent Lab stream cancelled", "AbortError"));
    },
    async start(controller) {
      const send = (frame: AgentLabStreamFrameValue) => {
        if (cancelled) return;
        const safeFrame = AgentLabStreamFrame.parse(frame);
        controller.enqueue(encoder.encode(`${JSON.stringify(safeFrame)}\n`));
      };

      try {
        const artifact = await runAgentLab(parsed.data, {
          signal: abortController.signal,
          runId,
          startedAtMs,
          onEvent: (event) => {
            events.push(event);
            send({ type: "event", event });
          },
        });
        send({ type: "complete", artifact });
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("[agent-lab] run failed", error);
          const message = "Unable to run this Agent Lab experiment.";
          const artifact = createFailedAgentLabArtifact(parsed.data, {
            runId,
            startedAtMs,
            events,
            message,
          });
          send({ type: "error", error: message, artifact });
        }
      } finally {
        if (!cancelled) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
