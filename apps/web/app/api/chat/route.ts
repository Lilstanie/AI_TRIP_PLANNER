import { NextResponse } from "next/server";
import {
  IncompleteBriefError,
  answerFlightQuery,
  parseFlightQuery,
  runTripChat,
} from "@trip/orchestrator";
import { createToolGateway, parseDataMode, runWithDataMode } from "@trip/tools";
import { tripStore } from "@trip/services";
import {
  ChatRequest,
  ChatResponse,
  type AgentProgressEvent,
  type ChatNeedsInfo,
  type FlightAnswer,
} from "@trip/shared";

export async function POST(req: Request) {
  // The workspace toggle states the mode per request; absent, the deployment's
  // USE_MOCK_TOOLS default applies.
  const dataMode = parseDataMode(req.headers.get("x-trip-data-mode"));
  const body = await req.json().catch(() => ({}));
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success || (parsed.data.mode === "plan" && !parsed.data.brief)) {
    return NextResponse.json({ error: "invalid ChatRequest" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      const send = (
        event:
          | AgentProgressEvent
          | ChatNeedsInfo
          | FlightAnswer
          | { type: "complete"; response: ChatResponse }
          | { type: "error"; error: string },
      ) => {
        if (cancelled) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        // A fare question is answered from the one provider it needs. Running
        // the planning workflow would spend five model calls to bury the number
        // in a trip nobody asked for.
        const flightQuery = parsed.data.plan ? undefined : parseFlightQuery(parsed.data.message);
        if (flightQuery) {
          const answer = await runWithDataMode(dataMode, () =>
            answerFlightQuery(flightQuery, createToolGateway().booking),
          );
          send(answer);
          return;
        }
        const response = ChatResponse.parse(
          await runWithDataMode(dataMode, () => runTripChat(parsed.data, { onProgress: send })),
        );
        await tripStore.set(response.plan);
        send({ type: "complete", response });
      } catch (error) {
        // A blank conversation that has not stated everything yet is a question
        // rather than a failure: the chat shows the assistant's own words, and
        // the traveller answers by typing.
        if (error instanceof IncompleteBriefError) {
          send(error.needsInfo);
        } else {
          console.error("[chat] planning failed", error);
          send({
            type: "error",
            error:
              error instanceof Error && error.message.startsWith("No valid stays")
                ? "No stays match your accommodation preferences. Lower the minimum rating or change cancellation preferences, then retry."
                : "Unable to update this trip. Check the request and try again.",
          });
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
