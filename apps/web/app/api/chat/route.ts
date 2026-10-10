import { NextResponse } from "next/server";
import {
  AskUserError,
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
  type ChatAskUser,
  type ChatNeedsInfo,
  type FlightAnswer,
} from "@trip/shared";
import { noticeBody, type Notice } from "@/lib/i18n/notice";

const INVALID_REQUEST: Notice = { key: "The request was invalid. Please retry." };

export async function POST(req: Request) {
  const dataMode = parseDataMode(req.headers.get("x-trip-data-mode"));
  const body = await req.json().catch(() => ({}));
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    const attachmentIssue = parsed.error.issues.find((issue) => issue.path[0] === "attachments");
    return NextResponse.json(
      noticeBody(
        attachmentIssue
          ? {
              key: "Attachment rejected: {reason}",
              params: { reason: { raw: attachmentIssue.message } },
            }
          : INVALID_REQUEST,
      ),
      { status: 400 },
    );
  }
  if (parsed.data.mode === "plan" && !parsed.data.brief) {
    return NextResponse.json(noticeBody(INVALID_REQUEST), { status: 400 });
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
          | ChatAskUser
          | FlightAnswer
          | { type: "complete"; response: ChatResponse }
          | ({ type: "error" } & ReturnType<typeof noticeBody>),
      ) => {
        if (cancelled) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const flightQuery = parseFlightQuery(parsed.data.message);
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
        if (error instanceof IncompleteBriefError) {
          send(error.needsInfo);
        } else if (error instanceof AskUserError) {
          send(error.askUser);
        } else {
          console.error("[chat] planning failed", error);
          const notice: Notice =
            error instanceof Error && error.message.startsWith("No valid stays")
              ? {
                  key: "No stays match your accommodation preferences. Lower the minimum rating or change cancellation preferences, then retry.",
                }
              : { key: "Unable to update this trip. Check the request and try again." };
          send({ type: "error", ...noticeBody(notice) });
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
