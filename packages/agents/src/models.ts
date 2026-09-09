import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";

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
} as const;

export type RoutedModelTask = keyof typeof MODEL_ROUTING;

/** DeepSeek thinking is on by default; set the env var to `false` for latency-sensitive runs. */
export function deepSeekThinkingEnabled(): boolean {
  return (process.env.DEEPSEEK_THINKING_ENABLED || "true").toLowerCase() !== "false";
}

export function deepSeekReasoningEffort(): "low" | "high" | "max" {
  const configured = (process.env.DEEPSEEK_REASONING_EFFORT || "high").toLowerCase();
  return configured === "low" || configured === "max" ? configured : "high";
}

export function routedModelName(task: RoutedModelTask): string {
  const provider = MODEL_ROUTING[task];
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY
      ? `DeepSeek · ${process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"}${deepSeekThinkingEnabled() ? " · thinking" : ""}`
      : "Deterministic fallback";
  }
  return process.env.MINIMAX_API_KEY
    ? `MiniMax · ${process.env.MINIMAX_MODEL || "MiniMax-M2.7"}`
    : "Deterministic fallback";
}

export function createRoutedChatModel(task: RoutedModelTask): ChatOpenAI | undefined {
  const provider = MODEL_ROUTING[task];
  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return undefined;
    const thinking = deepSeekThinkingEnabled();
    return new ChatOpenAI({
      apiKey,
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      // DeepSeek thinking mode does not support temperature/top_p. Omit them
      // entirely when enabled instead of sending a value the API ignores.
      ...(thinking ? {} : { temperature: 0 }),
      streamUsage: false,
      modelKwargs: thinking
        ? { thinking: { type: "enabled" }, reasoning_effort: deepSeekReasoningEffort() }
        : { thinking: { type: "disabled" } },
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
  const model = createRoutedChatModel(task);
  if (!model) return undefined;

  if (MODEL_ROUTING[task] === "deepseek" && !deepSeekThinkingEnabled()) {
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
