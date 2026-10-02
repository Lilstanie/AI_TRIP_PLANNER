import {
  agentLabStrategySupportsLive,
  createFailedAgentLabArtifact,
  runAgentLab,
} from "@trip/orchestrator";
import { liveLimiter, readLiveConfig } from "@/lib/agent-lab/live-gate";
import {
  AgentLabRunRequest,
  type AgentLabRejectionReason,
  AgentLabStreamFrame,
  type AgentLabRunEvent,
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
  if (!parsed.success) {
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
  const runId = `agent-lab-${crypto.randomUUID()}`;
  const startedAtMs = Date.now();
  const events: AgentLabRunEvent[] = [];
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
