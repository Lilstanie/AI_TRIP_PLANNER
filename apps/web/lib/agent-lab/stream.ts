import {
  AgentLabStreamFrame,
  type AgentLabRejectionReason,
  type AgentLabCompletedRunArtifact,
  type AgentLabFailedRunArtifact,
  type AgentLabRunEvent,
} from "@trip/shared";

export class AgentLabRunError extends Error {
  constructor(
    message: string,
    readonly artifact: AgentLabFailedRunArtifact,
  ) {
    super(message);
    this.name = "AgentLabRunError";
  }
}

export class AgentLabRejectedError extends Error {
  constructor(
    message: string,
    readonly reason: AgentLabRejectionReason,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AgentLabRejectedError";
  }
}

const INVALID_EVENT = "The experiment returned an invalid event.";

function parseFrame(line: string): AgentLabStreamFrame {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    throw new Error(INVALID_EVENT);
  }
  const parsed = AgentLabStreamFrame.safeParse(json);
  if (!parsed.success) throw new Error(INVALID_EVENT);
  return parsed.data;
}

export async function readAgentLabStream(
  response: Response,
  onEvent: (event: AgentLabRunEvent) => void,
): Promise<AgentLabCompletedRunArtifact> {
  if (!response.ok && response.body) {
    const text = await response.text();
    try {
      const frame = parseFrame(text.split("\n").find((line) => line.trim()) ?? "");
      if (frame.type === "rejected") {
        throw new AgentLabRejectedError(frame.message, frame.reason, frame.retryAfterSeconds);
      }
    } catch (caught) {
      if (caught instanceof AgentLabRejectedError) throw caught;
    }
    throw new Error("Unable to start this experiment.");
  }
  if (!response.ok || !response.body) throw new Error("Unable to start this experiment.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let artifact: AgentLabCompletedRunArtifact | undefined;

  const consume = (line: string) => {
    if (!line.trim()) return;
    const frame = parseFrame(line);
    if (frame.type === "rejected") {
      throw new AgentLabRejectedError(frame.message, frame.reason, frame.retryAfterSeconds);
    }
    if (frame.type === "event") onEvent(frame.event);
    else if (frame.type === "complete") artifact = frame.artifact;
    else throw new AgentLabRunError(frame.error, frame.artifact);
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consume);
    if (done) break;
  }
  consume(buffer);
  if (!artifact) throw new Error("The experiment ended without a completed artifact.");
  return artifact;
}
