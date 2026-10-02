import { isRegisteredAgentLabRun, runAgentLabToArtifact } from "@trip/orchestrator";
import {
  AgentLabRunRequest,
  AgentLabStreamFrame,
  type AgentLabStreamFrame as AgentLabStreamFrameValue,
} from "@trip/shared";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = AgentLabRunRequest.safeParse(body);
  // A fault is a registered profile on the scenario and strategy it was built for, or nothing.
  if (!parsed.success || !isRegisteredAgentLabRun(parsed.data)) {
    return NextResponse.json({ error: "Invalid Agent Lab request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
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
        // Ends in a completed artifact, or in a failed one that keeps the events recorded before the
        // failure. A cancelled run throws instead, and writes nothing more.
        const artifact = await runAgentLabToArtifact(parsed.data, {
          signal: abortController.signal,
          onEvent: (event) => send({ type: "event", event }),
        });
        if (artifact.status === "completed") send({ type: "complete", artifact });
        else send({ type: "error", error: artifact.failure.message, artifact });
      } catch {
        // Only a cancellation reaches here; the reader has gone, so there is nobody to tell.
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
