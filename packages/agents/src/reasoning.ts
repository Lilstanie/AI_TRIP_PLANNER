import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessageChunk, BaseMessage } from "@langchain/core/messages";

// DeepSeek's OpenAI-compatible endpoint returns a `reasoning_content` field on
// the delta of a thinking-mode response, and @langchain/openai carries it
// through in `additional_kwargs.reasoning_content` (see
// @langchain/openai/dist/converters/completions.js). LangChain's invoke() drops
// it: the value is never surfaced on the returned message, so a caller can only
// read the private reasoning by consuming the stream. This wrapper exists for
// exactly that reason — it turns invoke() into a stream, forwards each
// reasoning delta, and returns the same assembled message invoke() would have
// returned.
//
// The wrapper deliberately does not buffer the answer: the assembled chunk is
// returned unchanged, so structured-output parsing, tool calls and usage
// metadata behave as before.

/** Receives the model's private reasoning as it is produced. */
export type ReasoningListener = (text: string) => void;

/** Coerce one delta chunk's content into text, ignoring non-text parts. */
function chunkText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part)
        return String((part as { text: unknown }).text ?? "");
      return "";
    })
    .join("");
}

/** The reasoning text carried by one chunk, if any. */
function reasoningText(chunk: AIMessageChunk): string {
  const value = chunk.additional_kwargs?.reasoning_content;
  return typeof value === "string" ? value : "";
}

/**
 * Wrap a chat model so `invoke` streams internally and reports the model's
 * private reasoning as it arrives. Every other method is bound to the original,
 * so `bindTools`, `withStructuredOutput` and callback plumbing keep working.
 *
 * @param model - the model to wrap; returned unchanged when `onReasoning` is absent.
 * @param onReasoning - called with each reasoning delta, in order.
 * @returns a model whose `invoke` also reports reasoning.
 */
export function withReasoningStream(
  model: BaseChatModel,
  onReasoning: ReasoningListener | undefined,
): BaseChatModel {
  if (!onReasoning) return model;
  const target = model as BaseChatModel & {
    stream: (input: unknown, options?: unknown) => Promise<AsyncIterable<AIMessageChunk>>;
  };

  const invoke = async (input: unknown, options?: unknown): Promise<BaseMessage> => {
    let assembled: AIMessageChunk | undefined;
    // `stream` is typed on BaseChatModel; the wide signature here keeps this
    // wrapper free of the model's generic input type.
    for await (const chunk of await target.stream(input, options)) {
      const reasoning = reasoningText(chunk);
      if (reasoning) onReasoning(reasoning);
      assembled = assembled === undefined ? chunk : assembled.concat(chunk);
    }
    if (!assembled) throw new Error("The model returned no content.");
    return assembled;
  };

  // Methods that return another runnable have to be re-wrapped, or the model
  // LangChain actually calls is the un-wrapped one: `createAgent` builds its
  // loop from `bindTools(...)`, so a proxy that only replaces `invoke` never
  // sees a token.
  const wrapping = new Set(["bindTools", "bind", "withConfig", "withStructuredOutput"]);

  // A Proxy keeps every inherited method, getter and callback registration on
  // the real model while replacing exactly one method. Methods are not bound:
  // LangChain's runnables call each other through `this`, and rebinding them
  // would detach `stream` from the instance that owns the client.
  const proxy: BaseChatModel = new Proxy(model, {
    get(current, property, receiver) {
      if (property === "invoke") return invoke;
      const value = Reflect.get(current, property, receiver) as unknown;
      if (typeof value !== "function") return value;
      if (typeof property === "string" && wrapping.has(property))
        return (...args: unknown[]) =>
          withReasoningStream(
            (value as (...callArgs: unknown[]) => BaseChatModel).apply(current, args),
            onReasoning,
          );
      return value;
    },
  });
  return proxy;
}

/** Assemble streamed chunks the same way `invoke` would. Exported for tests. */
export function assembleChunks(chunks: AIMessageChunk[]): AIMessageChunk | undefined {
  return chunks.reduce<AIMessageChunk | undefined>(
    (assembled, chunk) => (assembled === undefined ? chunk : assembled.concat(chunk)),
    undefined,
  );
}

/** Text of an assembled chunk, for callers that only want the answer. */
export function messageText(chunk: AIMessageChunk | undefined): string {
  return chunkText(chunk?.content);
}
