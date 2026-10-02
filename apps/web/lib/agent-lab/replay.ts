import {
  AGENT_LAB_ARTIFACT_SCHEMA_VERSION,
  AgentLabRunArtifact,
  type AgentLabCompletedRunArtifact,
  type AgentLabRunEvent,
} from "@trip/shared";

export const MAX_REPLAY_BYTES = 5 * 1024 * 1024;
/** Fixture runs last seconds; a recording that would play longer is not a recording of one. */
export const MAX_REPLAY_MS = 10 * 60 * 1000;

export type ReplayParse =
  { ok: true; artifact: AgentLabCompletedRunArtifact } | { ok: false; message: string };

const reject = (message: string): ReplayParse => ({ ok: false, message });

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (text, part) =>
      typeof part === "number"
        ? `${text}[${part}]`
        : text
          ? `${text}.${String(part)}`
          : String(part),
    "",
  );
}

/** Says what is wrong in the terms a visitor can act on, not as a raw schema error. */
function describeInvalid(
  issues: readonly { message: string; path: readonly PropertyKey[] }[],
  raw: unknown,
) {
  const events = Array.isArray(record(raw)?.events) ? (record(raw)!.events as unknown[]) : [];
  const sequence = issues.find(
    (issue) => issue.path[0] === "events" && issue.path[2] === "sequence",
  );
  if (sequence && typeof sequence.path[1] === "number") {
    const position = sequence.path[1];
    const found = record(events[position])?.sequence;
    return (
      `The events are missing, duplicated or out of order: event ${position + 1} has sequence ` +
      `${JSON.stringify(found)}, expected ${position + 1}.`
    );
  }
  const owner = issues.find((issue) => issue.path[0] === "events" && issue.path.length === 2);
  if (owner && /metadata must match/.test(owner.message)) {
    return `Event ${Number(owner.path[1]) + 1} belongs to a different run, scenario, strategy or data mode than the artifact.`;
  }
  const [first, ...rest] = issues;
  const where = first!.path.length ? ` at ${formatPath(first!.path)}` : "";
  const more = rest.length
    ? ` (and ${rest.length} more ${rest.length === 1 ? "problem" : "problems"})`
    : "";
  return `The artifact is not valid${where}: ${first!.message}${more}.`;
}

/**
 * Turns a file's text into a replayable run, or says why it cannot be one. Nothing is guessed: an
 * unreadable, unsupported or inconsistent file is refused instead of being repaired into a plausible
 * run, and fields the contract does not define are dropped by validation.
 */
export function parseReplayArtifact(text: string): ReplayParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return reject("This file is not valid JSON, so it cannot be an Agent Lab artifact.");
  }
  const object = record(raw);
  if (!object || !("schemaVersion" in object)) {
    return reject("This file is not an Agent Lab artifact: it has no schema version.");
  }
  if (object.schemaVersion !== AGENT_LAB_ARTIFACT_SCHEMA_VERSION) {
    return reject(
      `This artifact uses schema version ${JSON.stringify(object.schemaVersion)}; this page replays version ${AGENT_LAB_ARTIFACT_SCHEMA_VERSION}.`,
    );
  }
  const parsed = AgentLabRunArtifact.safeParse(raw);
  if (!parsed.success) return reject(describeInvalid(parsed.error.issues, raw));
  const artifact = parsed.data;
  if (artifact.status === "failed") {
    return reject(
      "This artifact records a failed run; replaying a failed run is not supported yet.",
    );
  }
  for (let index = 1; index < artifact.events.length; index += 1) {
    const previous = artifact.events[index - 1]!.elapsedMs;
    const current = artifact.events[index]!.elapsedMs;
    if (current < previous) {
      return reject(
        `Event ${index + 1} is timed before event ${index} (${current} ms against ${previous} ms), so the recording cannot be replayed in order.`,
      );
    }
  }
  const span = artifact.events.at(-1)!.elapsedMs - artifact.events[0]!.elapsedMs;
  if (span > MAX_REPLAY_MS) {
    return reject(
      `This artifact records a run longer than ${MAX_REPLAY_MS / 60_000} minutes, which no registered strategy produces.`,
    );
  }
  return { ok: true, artifact };
}

/** Reads one chosen file, refusing an oversized one before reading it. */
export async function readReplayFile(file: File): Promise<ReplayParse> {
  if (file.size > MAX_REPLAY_BYTES) {
    return reject(
      `This file is larger than ${MAX_REPLAY_BYTES / (1024 * 1024)} MB; Agent Lab artifacts are far smaller.`,
    );
  }
  return parseReplayArtifact(await file.text());
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/**
 * Delivers the recorded events in order at their recorded offsets, measured from the first event
 * against one clock so timer lateness does not accumulate. Resolves true when every event was
 * delivered and false when the signal stopped it first.
 */
export async function replayEvents(
  events: readonly AgentLabRunEvent[],
  onEvent: (event: AgentLabRunEvent) => void,
  signal: AbortSignal,
): Promise<boolean> {
  const origin = events[0]?.elapsedMs ?? 0;
  const started = performance.now();
  for (const event of events) {
    const wait = event.elapsedMs - origin - (performance.now() - started);
    if (wait > 0) await sleep(wait, signal);
    if (signal.aborted) return false;
    onEvent(event);
  }
  return true;
}

export function artifactFilename(artifact: AgentLabCompletedRunArtifact): string {
  const run = artifact.runId.replace(/[^a-z0-9_-]/gi, "-");
  return `agent-lab-${artifact.scenarioId}-${artifact.strategyId}-${run}.json`;
}

/** Saves the artifact exactly as validated: the same bounded contract the stream completed with. */
export function downloadArtifact(artifact: AgentLabCompletedRunArtifact): string {
  const filename = artifactFilename(artifact);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the save after the click returns, so the URL outlives it briefly.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
