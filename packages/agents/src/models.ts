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
  const provider = MODEL_ROUTING[task];
  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return undefined;
    return new ChatOpenAI({
      apiKey,
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      temperature: 0,
      streamUsage: false,
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
