import { NextResponse, after } from "next/server";
import {
  AskUserError,
  IncompleteBriefError,
  answerFlightQuery,
  parseFlightQuery,
  runTripChat,
} from "@trip/orchestrator";
import { createToolGateway, runWithDataMode } from "@trip/tools";
import { runWithModelsDisabled } from "@trip/agents";
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
import { liveDataAllowed, requestDataMode } from "@/lib/auth/live-data";
import { authEnabled } from "@/lib/auth/config";
import { dbEnabled } from "@/lib/db/client";
import { accountMemoryStore, rememberAccountPreference } from "@/lib/account/memory";
import { accountMemoryEnabled } from "@/lib/account/memory-enabled";
import { recognizeAccountMemory } from "@/lib/account/recognize-memory.mjs";
import { CHAT_RUN_HEADER, chatRunRecorder, replayChatRun, validRunId } from "@/lib/chat/runs";

const INVALID_REQUEST: Notice = { key: "theRequestWasInvalidPlease" };

async function callerId() {
  return authEnabled && dbEnabled() ? ((await auth()).userId ?? undefined) : undefined;
}

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("run") ?? "";
  return replayChatRun(req, runId, (await callerId()) ?? "anonymous");
}

export async function POST(req: Request) {
  const dataMode = await requestDataMode(req);
  const modelsAllowed = await liveDataAllowed();
  const body = await req.json().catch(() => ({}));
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    const attachmentIssue = parsed.error.issues.find((issue) => issue.path[0] === "attachments");
    return NextResponse.json(
      noticeBody(
        attachmentIssue
          ? {
              key: "attachmentRejectedReason",
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
  const accountId = await callerId();
  const memoryEnabled =
    parsed.data.assistant?.memory !== false && (await accountMemoryEnabled(accountId));
  const serverUserId = accountId ?? "anonymous";
  const requestData = {
    ...parsed.data,
    ...(parsed.data.brief ? { brief: { ...parsed.data.brief, userId: serverUserId } } : {}),
    ...(parsed.data.known ? { known: { ...parsed.data.known, userId: serverUserId } } : {}),
  };
  const runId = req.headers.get(CHAT_RUN_HEADER);
  const recorder = validRunId(runId) ? chatRunRecorder(runId, serverUserId) : undefined;
  await recorder?.started;
  let open = true;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
    cancel() {
      open = false;
    },
  });
  const send = (
    event:
      | AgentProgressEvent
      | ChatNeedsInfo
      | ChatAskUser
      | FlightAnswer
      | { type: "complete"; response: ChatResponse }
      | ({ type: "error" } & ReturnType<typeof noticeBody>),
  ) => {
    recorder?.push(event);
    if (!open) return;
    try {
      controller?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      open = false;
    }
  };
  const turn = (async () => {
    try {
      const flightQuery = parseFlightQuery(parsed.data.message);
      if (flightQuery) {
        const answer = await runWithDataMode(dataMode, () =>
          answerFlightQuery(flightQuery, createToolGateway().booking),
        );
        send(answer);
        return;
      }
      const run = () =>
        runTripChat(requestData, {
          onProgress: send,
          mem: accountMemoryStore(accountId, memoryEnabled),
          accountMemory: Boolean(accountId) && memoryEnabled,
        });
      const response = ChatResponse.parse(
        await runWithDataMode(dataMode, () => (modelsAllowed ? run() : runWithModelsDisabled(run))),
      );
      const recognized = recognizeAccountMemory(parsed.data.message);
      const lasting =
        response.lastingPreferences?.map(({ key, value }) => ({
          key,
          value: key === "pace" ? `${value} pace` : value,
        })) ?? (recognized ? [recognized] : []);
      if (accountId && lasting.length && memoryEnabled) {
        try {
          for (const { key, value } of lasting)
            response.memoryChange =
              (await rememberAccountPreference(accountId, key, value)) ?? response.memoryChange;
        } catch (error) {
          console.warn("[chat] account memory write failed", error);
        }
      }
      delete response.lastingPreferences;
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
                key: "noStaysMatchYourAccommodation",
              }
            : { key: "unableToUpdateThisTrip" };
        send({ type: "error", ...noticeBody(notice) });
      }
    } finally {
      await recorder?.close();
      if (open) {
        open = false;
        controller?.close();
      }
    }
  })();
  after(() => turn);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
