import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessageChunk, BaseMessage } from "@langchain/core/messages";

export type ReasoningListener = (text: string) => void;

function reasoningText(chunk: AIMessageChunk): string {
  const value = chunk.additional_kwargs?.reasoning_content;
  return typeof value === "string" ? value : "";
}

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

    for await (const chunk of await target.stream(input, options)) {
      const reasoning = reasoningText(chunk);
      if (reasoning) onReasoning(reasoning);
      assembled = assembled === undefined ? chunk : assembled.concat(chunk);
    }
    if (!assembled) throw new Error("The model returned no content.");
    return assembled;
  };

  const wrapping = new Set(["bindTools", "bind", "withConfig", "withStructuredOutput"]);

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
