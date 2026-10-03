import { AsyncLocalStorage } from "node:async_hooks";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";

// Centralize provider selection and structured-output adaptation so every
// specialist uses the same environment configuration and retry behavior.

/**
 * Keep task-to-provider choices explicit. Every task currently routes to
 * DeepSeek: MiniMax produced comparable drafts but took 15-25s per structured
 * call, tripling full page-render latency. The MiniMax branch below stays
 * wired and working so a task can be routed back at any time. Agents still accept injected
 * generators in tests, while production resolves providers from environment
 * variables at call time.
 */
export const MODEL_ROUTING = {
  itinerary: "deepseek",
  "destination-guide": "deepseek",
  dining: "deepseek",
  transport: "deepseek",
  accommodation: "deepseek",
} as const;

/** Valid task names accepted by the provider/model routing helpers. */
export type RoutedModelTask = keyof typeof MODEL_ROUTING;

// A public fixture demo must never reach a paid model, whatever keys the deployment holds. Like the data
// mode, this travels with the request through AsyncLocalStorage and is never written to `process.env`, so
// one visitor's run cannot switch models on or off for another's.
const modelsDisabled = new AsyncLocalStorage<true>();

/** Runs `fn` with no model available: every routed model is `undefined`, so specialists take their deterministic path. */
export function runWithModelsDisabled<T>(fn: () => T): T {
  return modelsDisabled.run(true, fn);
}

/** What one run's model calls reported. A call that reported no usage is counted but never given tokens. */
export interface UsageSnapshot {
  calls: number;
  reported: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageCollector {
  /** Records one finished model call from its LangChain output; `undefined` is a call that failed. */
  record: (output?: unknown) => void;
  snapshot: () => UsageSnapshot;
}

const count = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;

/** The token counts a model response carries, from whichever shape the provider used, or undefined. */
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

/** Runs `fn` so every model it builds reports its usage to `collector`. */
export function runWithUsageCollector<T>(collector: UsageCollector, fn: () => T): T {
  return usageCollectors.run(collector, fn);
}

/**
 * The collector is captured when the model is built, inside the run, and not looked up when a callback
 * fires: LangChain may run callbacks in the background, outside the run's async context, and a lookup
 * there would lose the usage and report a run that called a model as one that did not.
 */
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

/**
 * Which model roles need private reasoning. The supervisor and the coordinator
 * decide what work to delegate and publish that thinking in the transcript, so
 * they run with thinking on. Specialists ask for structured output through a
 * forced tool call, and DeepSeek rejects a forced `tool_choice` in thinking
 * mode ("Thinking mode does not support this tool_choice"), so they stay off.
 */
export interface RoutedModelOptions {
  thinking?: boolean;
}

/** Create the chat model for a task, or return undefined when its credentials are absent. */
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
    // MiniMax requires temperature to be greater than zero.
    temperature: 0.1,
    streamUsage: false,
    callbacks: usageCallbacks(),
    configuration: { baseURL: process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1" },
  });
}

/**
 * MiniMax silently ignores a forced `tool_choice` (and `response_format`
 * json_schema): it answers in prose and returns no tool call, which looks
 * exactly like an auth failure from the caller's side. With `tool_choice:
 * "auto"` it emits a well-formed call, so bind the tool ourselves and validate
 * the arguments instead of relying on `withStructuredOutput`.
 */
export function createRoutedStructuredInvoker<Schema extends z.ZodType>(
  task: RoutedModelTask,
  schema: Schema,
  name: string,
): ((prompt: string) => Promise<z.infer<Schema>>) | undefined {
  // Build the model lazily: tests and offline runs can use deterministic paths
  // simply by omitting the provider key. Structured output forces a tool call,
  // so this path always runs with thinking off (see RoutedModelOptions).
  const model = createRoutedChatModel(task, { thinking: false });
  if (!model) return undefined;

  if (MODEL_ROUTING[task] === "deepseek") {
    // DeepSeek supports LangChain's native structured-output helper.
    const structured = model.withStructuredOutput(schema, { name, method: "functionCalling" });
    const call = (prompt: string) => structured.invoke(prompt) as Promise<z.infer<Schema>>;
    return (prompt) =>
      call(prompt).catch((error: unknown) => call(withCorrection(prompt, name, error)));
  }

  const bound = model.bindTools(
    [
      {
        type: "function",
        function: {
          name,
          description: `Return the ${name} payload.`,
          parameters: z.toJSONSchema(schema, { io: "input", target: "draft-7" }),
        },
      },
    ],
    { tool_choice: "auto" },
  );

  // MiniMax also treats the schema's `maxItems` and array types as advisory, so
  // give it one corrective attempt with the validation errors before the caller
  // falls back to deterministic output.
  const attempt = async (prompt: string): Promise<z.infer<Schema>> => {
    // Extract and validate the named tool call rather than trusting free-form text.
    const response = await bound.invoke(prompt);
    const call = response.tool_calls?.find((toolCall) => toolCall.name === name);
    if (!call) throw new Error(`${name}: model returned no tool call`);
    return schema.parse(call.args);
  };

  return async (prompt) => {
    try {
      return await attempt(prompt);
    } catch (error) {
      return attempt(withCorrection(prompt, name, error));
    }
  };
}

/** Feed the failure back so the model can repair its own output once. */
function withCorrection(prompt: string, name: string, error: unknown): string {
  const detail =
    error instanceof z.ZodError
      ? JSON.stringify(error.issues)
      : error instanceof Error
        ? error.message
        : "unknown model error";
  return `${prompt}\n\nA previous attempt failed. Call the ${name} tool and fix exactly these problems, respecting every type, minimum and maximum in the tool schema:\n${detail}`;
}

/**
 * Read a specialist agent's structured result.
 *
 * `createAgent` retries extraction a few times and then finishes with
 * `structuredResponse` left undefined. Parsing that directly reports "expected
 * object, received undefined" against the draft schema, which reads as a schema
 * bug rather than the agent having given up -- so name the real failure, and
 * validate in one place for every specialist.
 */
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
