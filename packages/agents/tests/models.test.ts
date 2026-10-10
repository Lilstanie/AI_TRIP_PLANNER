import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRoutedChatModel,
  createUsageCollector,
  runWithModelsDisabled,
  runWithUsageCollector,
} from "../src/models";

afterEach(() => vi.unstubAllEnvs());

const handlerOf = (model: ReturnType<typeof createRoutedChatModel>) =>
  (model!.callbacks as { handleLLMEnd: (output: unknown) => void }[])[0]!;

const tokenUsage = (promptTokens: number, completionTokens: number) => ({
  generations: [[{ text: "" }]],
  llmOutput: {
    tokenUsage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
  },
});

describe("runWithModelsDisabled", () => {
  it("builds no model inside its scope even when a key is configured, and one outside", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    expect(createRoutedChatModel("itinerary")).toBeDefined();
    expect(runWithModelsDisabled(() => createRoutedChatModel("itinerary"))).toBeUndefined();
    expect(createRoutedChatModel("itinerary")).toBeDefined();
  });

  it("does not leak into a run in flight beside it", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    const [disabled, enabled] = await Promise.all([
      runWithModelsDisabled(async () => {
        await tick();
        return createRoutedChatModel("dining");
      }),
      (async () => {
        await tick();
        return createRoutedChatModel("dining");
      })(),
    ]);
    expect(disabled).toBeUndefined();
    expect(enabled).toBeDefined();
  });
});

describe("usage collector", () => {
  it("sums what every model call reported", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const collector = createUsageCollector();
    runWithUsageCollector(collector, () => {
      const model = createRoutedChatModel("transport");
      handlerOf(model).handleLLMEnd(tokenUsage(100, 20));
      handlerOf(model).handleLLMEnd(tokenUsage(50, 10));
    });
    expect(collector.snapshot()).toEqual({
      calls: 2,
      reported: 2,
      inputTokens: 150,
      outputTokens: 30,
      totalTokens: 180,
    });
  });

  it("reads the message's usage metadata when the output has no token usage", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const collector = createUsageCollector();
    runWithUsageCollector(collector, () => {
      handlerOf(createRoutedChatModel("dining")).handleLLMEnd({
        generations: [
          [
            {
              text: "",
              message: { usage_metadata: { input_tokens: 7, output_tokens: 3, total_tokens: 10 } },
            },
          ],
        ],
      });
    });
    expect(collector.snapshot()).toMatchObject({ calls: 1, reported: 1, totalTokens: 10 });
  });

  it("counts a call that reported nothing as a call, never as zero tokens", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const collector = createUsageCollector();
    runWithUsageCollector(collector, () => {
      const model = createRoutedChatModel("itinerary");
      handlerOf(model).handleLLMEnd(tokenUsage(10, 5));
      handlerOf(model).handleLLMEnd({ generations: [[{ text: "no usage here" }]] });
    });
    const snapshot = collector.snapshot();
    expect(snapshot.calls).toBe(2);
    expect(snapshot.reported).toBe(1);
  });

  it("keeps one run's usage out of another's", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const [first, second] = [createUsageCollector(), createUsageCollector()];
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    await Promise.all([
      runWithUsageCollector(first, async () => {
        const model = createRoutedChatModel("transport");
        await tick();
        handlerOf(model).handleLLMEnd(tokenUsage(1, 1));
      }),
      runWithUsageCollector(second, async () => {
        const model = createRoutedChatModel("dining");
        await tick();
        handlerOf(model).handleLLMEnd(tokenUsage(100, 100));
      }),
    ]);
    expect(first.snapshot().totalTokens).toBe(2);
    expect(second.snapshot().totalTokens).toBe(200);
  });

  it("records nowhere, and does not throw, with no collector in scope", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    expect(() =>
      handlerOf(createRoutedChatModel("dining")).handleLLMEnd(tokenUsage(1, 1)),
    ).not.toThrow();
  });
});
