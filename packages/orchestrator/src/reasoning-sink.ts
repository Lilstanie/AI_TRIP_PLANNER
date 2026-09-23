import { withReasoningStream } from "@trip/agents";
import type { AgentName, AgentProgressEvent } from "@trip/shared";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Whose row carries the supervisor's or the coordinator's own thinking. Those
 * two models decide the shape of the whole run — which specialists to call,
 * what to revise, whether to replan — and itinerary is both always present and
 * the plan's spine, so their reasoning is published there rather than inventing
 * a pseudo-agent that could never appear in AGENT_NAMES.
 */
export const REASONING_OWNER: AgentName = "itinerary";

/**
 * Reasoning arrives as a token stream. Publishing every delta would put
 * hundreds of events on the wire, so deltas accumulate until the buffer is
 * worth reading. The block is flushed at the end of the model call either way,
 * so the tail of a thought is never lost. Flushing only paces the wire: every
 * flush of one sink continues the same block, see REASONING_BLOCK_INDEX.
 */
export const REASONING_FLUSH_CHARS = 160;

/**
 * The coordinator's own episode. It thinks before any round exists, so it owns
 * a reserved episode number rather than competing with the dispatch
 * supervisor's episode 0 for the same (round, index) identity.
 */
export const COORDINATOR_REASONING_EPISODE = 1000;

/**
 * The block index every flush of a sink carries. A sink covers one model call
 * chain, which a reader sees as one thought, so its flushes are deltas of one
 * growing block rather than separate blocks: numbering them apart made a client
 * render each 160-character slice as its own mid-sentence row.
 */
export const REASONING_BLOCK_INDEX = 0;

export interface ReasoningSink {
  /** Wrap a model so its private reasoning reaches the transcript. */
  wrap(model: BaseChatModel): BaseChatModel;
  /** Publish whatever is buffered. Safe to call more than once. */
  flush(): void;
}

/**
 * Collect a model's streamed private reasoning into transcript events.
 *
 * @param round - the orchestration round the thinking belongs to.
 * @param onProgress - the run's progress writer; absent in tests and offline runs.
 * @param episode - which model call chain this sink belongs to. A round can hold
 *   several (the dispatch supervisor and each revision pass), and each chain's
 *   block has the same index, so the episode is what keeps two chains' blocks
 *   apart.
 * @returns a sink that wraps a model and flushes the buffer.
 */
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
