import {
  agentLabStrategySupportsLive,
  isRegisteredAgentLabRun,
  runAgentLabToArtifact,
} from "@trip/orchestrator";
import { liveLimiter, readLiveConfig } from "@/lib/agent-lab/live-gate";
import {
  AgentLabRunRequest,
  type AgentLabRejectionReason,
  AgentLabStreamFrame,
  type AgentLabStreamFrame as AgentLabStreamFrameValue,
} from "@trip/shared";
import { NextResponse } from "next/server";

/**
 * A request turned away before any run starts. It is a single typed frame, so the page can say why nothing
 * began, and it is never an artifact: a rejection is not a failed experiment.
 */
function rejected(
  status: number,
  reason: AgentLabRejectionReason,
  message: string,
  retryAfterSeconds?: number,
) {
  const frame = AgentLabStreamFrame.parse({
    type: "rejected",
    reason,
    message,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
  return new Response(`${JSON.stringify(frame)}\n`, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      ...(retryAfterSeconds === undefined ? {} : { "Retry-After": String(retryAfterSeconds) }),
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = AgentLabRunRequest.safeParse(body);
  // A fault is a registered profile on the scenario and strategy it was built for, or nothing.
  if (!parsed.success || !isRegisteredAgentLabRun(parsed.data)) {
    return NextResponse.json({ error: "Invalid Agent Lab request" }, { status: 400 });
  }

  // Live data uses the deployment's own models and providers, so it is gated three ways before anything
  // runs: the deployment must have enabled it, the strategy must have a live implementation, and the
  // concurrency and hourly limits must have room. Fixture data is never gated and needs none of this.
  let release: (() => void) | undefined;
  if (parsed.data.dataMode === "live") {
    const config = readLiveConfig();
    if (!config.enabled) {
      return rejected(
        503,
        "live_disabled",
        "Live runs are not enabled on this deployment. Fixture data is available.",
      );
    }
    if (!agentLabStrategySupportsLive(parsed.data.strategyId)) {
      return rejected(
        400,
        "live_unsupported",
        "This strategy replays a recording and has no live implementation. Choose a specialist strategy or use fixture data.",
      );
    }
    const admission = liveLimiter().tryAcquire(config);
    if (!admission.ok) {
      return rejected(
        429,
        admission.reason,
        admission.reason === "concurrency_limit"
          ? "A live run is already in progress."
          : "Live runs have reached their limit for now.",
        admission.retryAfterSeconds,
      );
    }
    release = admission.release;
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
      // A cancelled run frees its slot at once instead of holding it until the run notices the abort.
      release?.();
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
        release?.();
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
