import { withReasoningStream } from "@trip/agents";
import type { AgentName, AgentProgressEvent } from "@trip/shared";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export const REASONING_OWNER: AgentName = "itinerary";

export const REASONING_FLUSH_CHARS = 160;

export const COORDINATOR_REASONING_EPISODE = 1000;

export const REASONING_BLOCK_INDEX = 0;

export interface ReasoningSink {
  wrap(model: BaseChatModel): BaseChatModel;

  flush(): void;
}

export function createReasoningSink(
  round: number,
  onProgress: ((event: AgentProgressEvent) => void) | undefined,
  episode = 0,
): ReasoningSink {
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    onProgress?.({
      type: "agent_reasoning",
      agent: REASONING_OWNER,
      round,
      episode,
      index: REASONING_BLOCK_INDEX,
      text: buffer,
    });
    buffer = "";
  };
  return {
    wrap: (model) =>
      withReasoningStream(model, (text) => {
        buffer += text;
        if (buffer.length >= REASONING_FLUSH_CHARS) flush();
      }),
    flush,
  };
}
