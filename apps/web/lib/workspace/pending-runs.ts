import type { Message } from "./workspace";
import type { Task } from "./session";

export const PENDING_RUNS_KEY = "trip-planner:pending-runs";
const MAX_AGE_MS = 60 * 60 * 1000;

export type PendingRun = {
  runId: string;
  task: Task;
  message?: Message;
  startedAt: number;
};

let leaving = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    leaving = true;
  });
  window.addEventListener("pageshow", () => {
    leaving = false;
  });
}

export function pageLeaving() {
  return leaving;
}

function readAll(storage: Pick<Storage, "getItem"> = localStorage): Record<string, PendingRun> {
  try {
    const parsed = JSON.parse(storage.getItem(PENDING_RUNS_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const fresh: Record<string, PendingRun> = {};
    for (const [conversationId, run] of Object.entries(parsed as Record<string, PendingRun>))
      if (run && typeof run.runId === "string" && Date.now() - run.startedAt < MAX_AGE_MS)
        fresh[conversationId] = run;
    return fresh;
  } catch {
    return {};
  }
}

function writeAll(runs: Record<string, PendingRun>) {
  try {
    if (Object.keys(runs).length) localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(runs));
    else localStorage.removeItem(PENDING_RUNS_KEY);
  } catch {
    return;
  }
}

export function pendingRun(
  conversationId: string,
  storage?: Pick<Storage, "getItem">,
): PendingRun | undefined {
  return readAll(storage)[conversationId];
}

export function rememberPendingRun(conversationId: string, run: PendingRun) {
  const { attachments: _attachments, ...request } = run.task.request;
  const message = run.message && { ...run.message, attachments: undefined };
  writeAll({
    ...readAll(),
    [conversationId]: { ...run, task: { ...run.task, request }, ...(message ? { message } : {}) },
  });
}

export function forgetPendingRun(conversationId: string, runId?: string) {
  const runs = readAll();
  if (!runs[conversationId] || (runId && runs[conversationId].runId !== runId)) return;
  delete runs[conversationId];
  writeAll(runs);
}
