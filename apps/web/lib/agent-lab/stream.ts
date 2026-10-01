import {
  AgentLabStreamFrame,
  type AgentLabCompletedRunArtifact,
  type AgentLabFailedRunArtifact,
  type AgentLabRunEvent,
} from "@trip/shared";

/** The run failed after streaming started; `artifact` holds the events recorded before the failure. */
export class AgentLabRunError extends Error {
  constructor(
    message: string,
    readonly artifact: AgentLabFailedRunArtifact,
  ) {
    super(message);
    this.name = "AgentLabRunError";
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

/** Reads the NDJSON run stream, delivering each validated event and returning the completed artifact. */
export async function readAgentLabStream(
  response: Response,
  onEvent: (event: AgentLabRunEvent) => void,
): Promise<AgentLabCompletedRunArtifact> {
  if (!response.ok || !response.body) throw new Error("Unable to start this experiment.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let artifact: AgentLabCompletedRunArtifact | undefined;

  const consume = (line: string) => {
    if (!line.trim()) return;
    const frame = parseFrame(line);
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
