// @trip/llm — a thin OpenRouter (OpenAI-compatible) chat client. Owner: A.
//
// Free-tier models on OpenRouter are flaky (HTTP 429 / 502, or an empty body),
// so `chat()` retries and falls back across a small list of free models.
// Config (all optional, from .env.local):
//   OPENROUTER_API_KEY   — required to make a real call
//   OPENROUTER_BASE_URL  — default https://openrouter.ai/api/v1
//   AI_MODEL             — primary model id, default "openrouter/free"

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
}

const BASE_URL = () => process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const PRIMARY_MODEL = () => process.env.AI_MODEL ?? "openrouter/free";
const FREE_FALLBACKS = [
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "cohere/north-mini-code:free",
];

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

interface CompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/** Send a chat completion. Throws only after every model + retry has failed. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set — add it to .env.local (never commit it).");
  }
  const primary = PRIMARY_MODEL();
  const models = opts.models ?? [primary, ...FREE_FALLBACKS.filter((m) => m !== primary)];

  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      opts.signal?.throwIfAborted();
      try {
        const res = await fetch(`${BASE_URL()}/chat/completions`, {
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
          lastError = new Error(`OpenRouter ${res.status}: ${data.error?.message ?? res.statusText}`);
        } else {
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
          lastError = new Error("OpenRouter returned an empty completion.");
        }
      } catch (err) {
        lastError = err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw new Error(`OpenRouter chat failed after retries: ${String(lastError)}`);
}

/** Chat, then pull the first {...} block out of the reply and JSON.parse it. */
export async function chatJson<T>(messages: ChatMessage[], opts?: ChatOptions): Promise<T> {
  const raw = await chat(messages, opts);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected a JSON object in the model output: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}
