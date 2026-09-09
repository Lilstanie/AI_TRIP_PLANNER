import { NextResponse } from "next/server";
import { runTripChat } from "@trip/orchestrator";
import { ChatRequest, ChatResponse, ChatStreamEvent } from "@trip/shared";

function publicError(error: unknown): string {
  if (error instanceof Error && error.message === "Tell me a destination to start your trip.") {
    return error.message;
  }
  return "Unable to update this trip. Check the request and try again.";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid ChatRequest" }, { status: 400 });
  }

  if (req.headers.get("accept")?.includes("application/x-ndjson")) {
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: unknown) => {
          if (closed) return;
          try {
            const line = `${JSON.stringify(ChatStreamEvent.parse(event))}\n`;
            controller.enqueue(encoder.encode(line));
          } catch (error) {
            // A disconnected browser should not turn an otherwise valid run
            // into an unhandled server error.
            closed = true;
            console.warn("[chat] progress stream closed", error);
            try {
              controller.error(error);
            } catch {
              // The reader may already have disconnected.
            }
          }
        };

        void runTripChat(parsed.data, {
          onProgress(progress) {
            send({ type: "progress", progress });
          },
        })
          .then((response) => send({ type: "result", response }))
          .catch((error) => {
            console.error("[chat] streamed planning failed", error);
            send({
              type: "error",
              error: publicError(error),
            });
          })
          .finally(() => {
            if (!closed) controller.close();
            closed = true;
          });
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  }

  try {
    return NextResponse.json(ChatResponse.parse(await runTripChat(parsed.data)));
  } catch (error) {
    console.error("[chat] planning failed", error);
    return NextResponse.json({ error: publicError(error) }, { status: 422 });
  }
}
