import { AIMessageChunk } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { describe, expect, it } from "vitest";
import type { AgentProgressEvent } from "@trip/shared";
import { withReasoningStream } from "@trip/agents";
import { createReasoningSink, REASONING_FLUSH_CHARS, REASONING_OWNER } from "../src/reasoning-sink";

/** A model stub whose only behaviour is a scripted stream of deltas. */
function streamingModel(deltas: Array<{ content?: string; reasoning?: string }>) {
  return {
    stream: async function* () {
      for (const delta of deltas) {
        yield new AIMessageChunk({
          content: delta.content ?? "",
          additional_kwargs:
            delta.reasoning === undefined ? {} : { reasoning_content: delta.reasoning },
        });
      }
    },
  } as unknown as BaseChatModel;
}

function reasoningEvents(events: AgentProgressEvent[]) {
  return events.flatMap((event) => (event.type === "agent_reasoning" ? [event] : []));
}

describe("reasoning stream", () => {
  it("reports each reasoning delta and still returns the assembled answer", async () => {
    const seen: string[] = [];
    const model = withReasoningStream(
      streamingModel([
        { reasoning: "Weighing " },
        { reasoning: "the options. " },
        { content: "Final answer." },
      ]),
      (text) => seen.push(text),
    );

    const message = await model.invoke("anything");

    expect(seen.join("")).toBe("Weighing the options. ");
    expect(message.content).toBe("Final answer.");
  });

  it("returns the model untouched when nothing is listening", () => {
    const original = streamingModel([{ content: "hi" }]);

    expect(withReasoningStream(original, undefined)).toBe(original);
  });
});

describe("reasoning sink", () => {
  it("publishes a complete thinking block as numbered events for its round", async () => {
    const events: AgentProgressEvent[] = [];
    const sink = createReasoningSink(2, (event) => events.push(event));
    const long = "a".repeat(REASONING_FLUSH_CHARS);

    await sink
      .wrap(streamingModel([{ reasoning: long }, { reasoning: long }, { content: "answer" }]))
      .invoke("anything");
    sink.flush();

    const reasoning = reasoningEvents(events);
    expect(reasoning.map((event) => event.text).join("")).toBe(long + long);
    expect(reasoning.length).toBeGreaterThan(1);
    for (const [index, event] of reasoning.entries()) {
      expect(event.agent).toBe(REASONING_OWNER);
      expect(event.round).toBe(2);
      expect(event.episode).toBe(0);
      expect(event.index).toBe(index);
    }
  });

  it("names the model call chain, so two chains in one round cannot collide", async () => {
    const events: AgentProgressEvent[] = [];
    const dispatch = createReasoningSink(2, (event) => events.push(event), 0);
    const revision = createReasoningSink(2, (event) => events.push(event), 2);

    await dispatch.wrap(streamingModel([{ reasoning: "dispatching" }])).invoke("x");
    await revision.wrap(streamingModel([{ reasoning: "revising" }])).invoke("x");
    dispatch.flush();
    revision.flush();

    const reasoning = reasoningEvents(events);
    expect(reasoning.map((event) => [event.episode, event.index, event.text])).toEqual([
      [0, 0, "dispatching"],
      [2, 0, "revising"],
    ]);
  });

  it("holds a short thought back until the model call ends", () => {
    const events: AgentProgressEvent[] = [];
    const sink = createReasoningSink(1, (event) => events.push(event));
    const model = sink.wrap(streamingModel([{ reasoning: "Just a short thought." }]));

    return model.invoke("anything").then(() => {
      expect(reasoningEvents(events)).toEqual([]);
      sink.flush();
      expect(reasoningEvents(events).map((event) => event.text)).toEqual(["Just a short thought."]);
    });
  });

  it("publishes nothing when the model produced no reasoning", () => {
    const events: AgentProgressEvent[] = [];
    const sink = createReasoningSink(1, (event) => events.push(event));
    const model = sink.wrap(streamingModel([{ content: "Just an answer." }]));

    return model.invoke("anything").then(() => {
      sink.flush();
      expect(events).toEqual([]);
    });
  });
});
