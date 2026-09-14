import type { AgentProgressEvent, ChatResponse } from "@trip/shared";

export type ChatStreamFrame =
  | AgentProgressEvent
  | { type: "complete"; response: ChatResponse }
  | { type: "error"; error: string };

export async function requestTripUpdate({
  tripId,
  message,
  brief,
  signal,
  onProgress,
}: {
  tripId: string;
  message: string;
  brief: ChatResponse["plan"]["brief"];
  signal?: AbortSignal;
  onProgress?: (event: AgentProgressEvent) => void;
}): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson" },
    body: JSON.stringify({ tripId, message, brief }),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Chat request failed (${response.status}).`);
  }
  if (!response.body) throw new Error("The planning stream was unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResponse | undefined;
  let streamError: string | undefined;

  const consume = (line: string) => {
    if (!line.trim()) return;
    const frame = JSON.parse(line) as ChatStreamFrame;
    if (
      frame.type === "agent_started" ||
      frame.type === "agent_completed" ||
      frame.type === "agent_failed"
    ) {
      onProgress?.(frame);
    } else if (frame.type === "complete") {
      result = frame.response;
    } else if (frame.type === "error") {
      streamError = frame.error;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
    if (done) break;
  }
  consume(buffer);

  if (!result) throw new Error(streamError ?? "The planning stream ended without a plan.");
  return result;
}
