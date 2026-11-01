import { jsonStore } from "@trip/services";
import { noticeBody } from "@/lib/i18n/notice";

export { CHAT_RUN_HEADER } from "./run-header";

const RUN_TTL_SECONDS = 60 * 60;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChatRun = {
  owner: string;
  status: "running" | "done";
  frames: unknown[];
  updatedAt: number;
};

const runKey = (id: string) => `chat:run:${id}`;
const LOST = noticeBody({ key: "thisReplyCouldNotBeRecovered" });

export function validRunId(value: string | null | undefined): value is string {
  return typeof value === "string" && RUN_ID.test(value);
}

export function readChatRun(id: string): Promise<ChatRun | undefined> {
  return jsonStore.get<ChatRun>(runKey(id));
}

/**
 * Records every frame of one chat turn under its run id so a reloaded page can replay it.
 * Writes are serialised and coalesced; `close()` resolves once the finished run is stored.
 * Store failures are logged and never interrupt the turn itself.
 */
export function chatRunRecorder(id: string, owner: string) {
  const run: ChatRun = { owner, status: "running", frames: [], updatedAt: Date.now() };
  let writing: Promise<void> = Promise.resolve();
  let queued = false;
  const write = () => {
    if (queued) return writing;
    queued = true;
    writing = writing.then(async () => {
      queued = false;
      run.updatedAt = Date.now();
      try {
        await jsonStore.set(runKey(id), run, { ttlSeconds: RUN_TTL_SECONDS });
      } catch (error) {
        console.warn("[chat] run record write failed", error);
      }
    });
    return writing;
  };
  return {
    started: write(),
    push(frame: unknown) {
      run.frames.push(frame);
      void write();
    },
    close() {
      run.status = "done";
      return write();
    },
  };
}

const POLL_MS = 500;
const STALE_MS = 5 * 60 * 1000;
const REPLAY_LIMIT_MS = 4 * 60 * 1000;

/**
 * Streams a recorded chat turn as NDJSON: every stored frame, then new frames until the run is done.
 * Returns 404 with a notice when the run is unknown, expired or owned by someone else.
 */
export async function replayChatRun(req: Request, runId: string, owner: string): Promise<Response> {
  const first = validRunId(runId) ? await readChatRun(runId) : undefined;
  if (!first || first.owner !== owner) return Response.json(LOST, { status: 404 });

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      const startedAt = Date.now();
      let run = first;
      let sent = 0;
      try {
        while (!cancelled && !req.signal.aborted) {
          for (; sent < run.frames.length; sent++)
            controller.enqueue(encoder.encode(`${JSON.stringify(run.frames[sent])}\n`));
          if (run.status === "done") break;
          if (Date.now() - run.updatedAt > STALE_MS || Date.now() - startedAt > REPLAY_LIMIT_MS) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", ...LOST })}\n`));
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          const next = await readChatRun(runId);
          if (!next) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", ...LOST })}\n`));
            break;
          }
          run = next;
        }
      } catch (error) {
        if (!cancelled) console.warn("[chat] run replay failed", error);
      } finally {
        if (!cancelled) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
