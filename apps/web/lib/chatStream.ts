import type { ChatResponse, ChatRunProgress, ChatStreamEvent } from "@trip/shared";

function streamEvent(value: unknown): ChatStreamEvent {
  if (!value || typeof value !== "object" || !("type" in value)) {
    throw new Error("The planning stream returned an invalid event.");
  }
  const event = value as Partial<ChatStreamEvent>;
  if (event.type === "progress" && "progress" in event) return event as ChatStreamEvent;
  if (event.type === "result" && "response" in event) return event as ChatStreamEvent;
  if (event.type === "error" && "error" in event) return event as ChatStreamEvent;
  throw new Error("The planning stream returned an invalid event.");
}

/** Consume newline-delimited progress events and return the existing final response. */
export async function readChatStream(
  response: Response,
  onProgress: (progress: ChatRunProgress) => void,
): Promise<ChatResponse> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Unable to update this trip.");
  }
  if (!response.body) throw new Error("The planning stream was unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResponse | undefined;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    // The API validates every outgoing line with the shared Zod schema. Keep
    // this client guard lightweight so the schema runtime is not added to the
    // browser bundle.
    const event = streamEvent(JSON.parse(line));
    if (event.type === "progress") onProgress(event.progress);
    if (event.type === "result") result = event.response;
    if (event.type === "error") throw new Error(event.error);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
  }
  buffer += decoder.decode();
  consumeLine(buffer);

  if (!result) throw new Error("The planning stream ended before returning a plan.");
  return result;
}
