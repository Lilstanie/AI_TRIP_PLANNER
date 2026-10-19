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
import { auth } from "@clerk/nextjs/server";
import {
  ChatRequest,
  ChatResponse,
  type AgentProgressEvent,
  type ChatAskUser,
  type ChatNeedsInfo,
  type FlightAnswer,
} from "@trip/shared";
import { noticeBody, type Notice } from "@/lib/i18n/notice";
import { authEnabled } from "@/lib/auth/config";
import { dbEnabled } from "@/lib/db/client";
import { accountMemoryStore, rememberAccountPreference } from "@/lib/account/memory";
import { accountMemoryEnabled } from "@/lib/account/memory-enabled";
import { recognizeAccountMemory } from "@/lib/account/recognize-memory.mjs";

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
  const accountId = authEnabled && dbEnabled() ? ((await auth()).userId ?? undefined) : undefined;
  const memoryEnabled =
    parsed.data.assistant?.memory !== false && (await accountMemoryEnabled(accountId));
  const serverUserId = accountId ?? "anonymous";
  const requestData = {
    ...parsed.data,
    ...(parsed.data.brief ? { brief: { ...parsed.data.brief, userId: serverUserId } } : {}),
    ...(parsed.data.known ? { known: { ...parsed.data.known, userId: serverUserId } } : {}),
  };
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
          await runWithDataMode(dataMode, () =>
            runTripChat(requestData, {
              onProgress: send,
              mem: accountMemoryStore(accountId, memoryEnabled),
            }),
          ),
        );
        const recognized = recognizeAccountMemory(parsed.data.message);
        if (!cancelled && accountId && recognized && memoryEnabled) {
          try {
            response.memoryChange = await rememberAccountPreference(
              accountId,
              recognized.key,
              recognized.value,
            );
          } catch (error) {
            console.warn("[chat] account memory write failed", error);
          }
        }
        send({ type: "complete", response });
        const persistence = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            tripStore.set(response.plan, { signal: persistence.signal }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                persistence.abort();
                reject(new Error("Trip persistence deadline exceeded."));
              }, 5000);
            }),
          ]);
        } catch (error) {
          console.warn("[chat] completed plan was delivered; server persistence failed", error);
        } finally {
          clearTimeout(timer);
        }
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
