import { AsyncLocalStorage } from "node:async_hooks";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";

export const MODEL_ROUTING = {
  itinerary: "deepseek",
  "destination-guide": "deepseek",
  dining: "deepseek",
  transport: "deepseek",
  accommodation: "deepseek",
} as const;

export type RoutedModelTask = keyof typeof MODEL_ROUTING;

const modelsDisabled = new AsyncLocalStorage<true>();

export function runWithModelsDisabled<T>(fn: () => T): T {
  return modelsDisabled.run(true, fn);
}

export interface UsageSnapshot {
  calls: number;
  reported: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageCollector {
  record: (output?: unknown) => void;
  snapshot: () => UsageSnapshot;
}

const count = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;

function usageOf(output: unknown): { input: number; output: number; total: number } | undefined {
  const result = output as {
    llmOutput?: { tokenUsage?: Record<string, unknown> };
    generations?: { message?: { usage_metadata?: Record<string, unknown> } }[][];
  };
  const fromOutput = result?.llmOutput?.tokenUsage;
  const fromMessage = result?.generations?.[0]?.[0]?.message?.usage_metadata;
  const input = count(fromOutput?.promptTokens) ?? count(fromMessage?.input_tokens);
  const out = count(fromOutput?.completionTokens) ?? count(fromMessage?.output_tokens);
  if (input === undefined || out === undefined) return undefined;
  const total = count(fromOutput?.totalTokens) ?? count(fromMessage?.total_tokens) ?? input + out;
  return { input, output: out, total };
}

export function createUsageCollector(): UsageCollector {
  const state: UsageSnapshot = {
    calls: 0,
    reported: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  return {
    record(output) {
      state.calls += 1;
      const usage = output === undefined ? undefined : usageOf(output);
      if (!usage) return;
      state.reported += 1;
      state.inputTokens += usage.input;
      state.outputTokens += usage.output;
      state.totalTokens += usage.total;
    },
    snapshot: () => ({ ...state }),
  };
}

const usageCollectors = new AsyncLocalStorage<UsageCollector>();

export function runWithUsageCollector<T>(collector: UsageCollector, fn: () => T): T {
  return usageCollectors.run(collector, fn);
}

function usageCallbacks() {
  const collector = usageCollectors.getStore();
  return collector
    ? [
        {
          handleLLMEnd: (output: unknown) => collector.record(output),
          handleLLMError: () => collector.record(undefined),
        },
      ]
    : [{ handleLLMEnd: () => {}, handleLLMError: () => {} }];
}

export interface RoutedModelOptions {
  thinking?: boolean;
}

export function createRoutedChatModel(
  task: RoutedModelTask,
  options: RoutedModelOptions = {},
): ChatOpenAI | undefined {
  if (modelsDisabled.getStore()) return undefined;
  const provider = MODEL_ROUTING[task];
  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return undefined;
    return new ChatOpenAI({
      apiKey,
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      temperature: 0,
      streamUsage: false,
      callbacks: usageCallbacks(),
      modelKwargs: { thinking: { type: options.thinking ? "enabled" : "disabled" } },
      configuration: {
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      },
    });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return undefined;
  return new ChatOpenAI({
    apiKey,
    model: process.env.MINIMAX_MODEL || "MiniMax-M2.7",

    temperature: 0.1,
    streamUsage: false,
    callbacks: usageCallbacks(),
    configuration: { baseURL: process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1" },
  });
}

export function readStructuredResponse<Schema extends z.ZodType>(
  agentName: string,
  schema: Schema,
  result: { structuredResponse?: unknown },
): z.infer<Schema> {
  if (result.structuredResponse === undefined) {
    throw new Error(`${agentName}: the specialist finished without producing a structured result.`);
  }
  return schema.parse(result.structuredResponse);
}
