// @trip/llm — a thin OpenRouter (OpenAI-compatible) chat client. Owner: A.
//
// Free-tier models on OpenRouter are unreliable: HTTP 429 (rate-limited upstream),
// 502, or a 200 with an empty body. So this client:
//   1. tries the pinned model (AI_MODEL), then a fallback chain;
//   2. retries each with backoff;
//   3. treats an empty completion as a failure, never returns "".
// Even so, a call CAN fail entirely — use `chatOrNull()` in agents and fall back
// to deterministic logic, so a flaky endpoint degrades a section, never crashes
// the whole plan.
//
// Config (all optional, from .env.local):
//   OPENROUTER_API_KEY   — required to make a real call
//   OPENROUTER_BASE_URL  — default https://openrouter.ai/api/v1
//   AI_MODEL             — primary model id, default google/gemma-4-26b-a4b-it:free

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** override the model list for this call */
  models?: string[];
  /** attempts per model before moving on (default 2) */
  retriesPerModel?: number;
}

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";
// If the pinned model is rate-limited, fall through to a bigger Gemma, then the
// free auto-router (which itself retries across every free provider).
const FALLBACK_CHAIN = ["google/gemma-4-31b-it:free", "openrouter/free"];

const baseUrl = () => process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const primaryModel = () => process.env.AI_MODEL || DEFAULT_MODEL;

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

interface CompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send a chat completion. Throws only after every model + retry has failed.
 * The returned string is always non-empty.
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set — add it to .env.local (never commit it).");
  }
  const primary = primaryModel();
  const models = opts.models ?? [
    primary,
    ...FALLBACK_CHAIN.filter((model) => model !== primary),
  ];
  const retries = opts.retriesPerModel ?? 2;

  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < retries; attempt++) {
      opts.signal?.throwIfAborted();
      try {
        const res = await fetch(`${baseUrl()}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: opts.temperature ?? 0.2,
            max_tokens: opts.maxTokens ?? 800,
          }),
          signal: opts.signal,
        });
        const data = (await res.json().catch(() => ({}))) as CompletionResponse;
        if (!res.ok || data.error) {
          lastError = new Error(
            `OpenRouter ${res.status} (${model}): ${data.error?.message ?? res.statusText}`,
          );
        } else {
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
          lastError = new Error(`OpenRouter returned an empty completion (${model}).`);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        lastError = err;
      }
      await sleep(350 * (attempt + 1));
    }
  }
  throw new Error(`OpenRouter chat failed after retries: ${String(lastError)}`);
}

/** Like `chat()` but returns `null` instead of throwing. Use this in agents. */
export async function chatOrNull(
  messages: ChatMessage[],
  opts?: ChatOptions,
): Promise<string | null> {
  try {
    return await chat(messages, opts);
  } catch {
    return null;
  }
}

/** Chat, then pull the first {...} block out of the reply and JSON.parse it. Throws on failure. */
export async function chatJson<T>(messages: ChatMessage[], opts?: ChatOptions): Promise<T> {
  const raw = await chat(messages, opts);
  return parseJsonBlock<T>(raw);
}

/** Like `chatJson()` but returns `null` on any failure (network, empty, unparseable). */
export async function chatJsonOrNull<T>(
  messages: ChatMessage[],
  opts?: ChatOptions,
): Promise<T | null> {
  const raw = await chatOrNull(messages, opts);
  if (raw === null) return null;
  try {
    return parseJsonBlock<T>(raw);
  } catch {
    return null;
  }
}

function parseJsonBlock<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected a JSON object in the model output: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}
