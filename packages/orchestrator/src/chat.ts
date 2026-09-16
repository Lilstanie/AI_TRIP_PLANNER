import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { createRoutedChatModel } from "@trip/agents";
import { memory } from "@trip/services";
import {
  ChatTurn,
  TripBrief as TripBriefSchema,
  type ChatRequest,
  type ChatResponse,
  type MemoryStore,
  type TripBrief,
} from "@trip/shared";
import { z } from "zod/v4";
import { DEMO_BRIEF } from "./demo";
import { runOrchestrator, type OrchestratorOptions } from "./workflow";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const BriefPatchSchema = z.object({
  destination: z.string().trim().min(1).optional(),
  dates: z.tuple([z.string().regex(ISO_DATE), z.string().regex(ISO_DATE)]).optional(),
  groupSize: z.number().int().positive().optional(),
  budgetTotal: z.number().positive().optional(),
  nationality: z.string().trim().min(1).optional(),
});

export type BriefPatch = z.infer<typeof BriefPatchSchema>;

export interface BriefExtractor {
  extract(message: string, current: TripBrief): Promise<BriefPatch>;
}

export interface ReplyGenerator {
  generate(prompt: string): Promise<string>;
}

export interface TripChatOptions extends OrchestratorOptions {
  extractor?: BriefExtractor;
  replyGenerator?: ReplyGenerator;
}

const ModelPatchSchema = z.object({
  destination: z.string().trim().min(1).nullable(),
  dates: z.tuple([z.string().regex(ISO_DATE), z.string().regex(ISO_DATE)]).nullable(),
  groupSize: z.number().int().positive().nullable(),
  budgetTotal: z.number().positive().nullable(),
  nationality: z.string().trim().min(1).nullable(),
});

// OpenAI strict JSON Schema does not accept a tuple whose array items are
// primitive values. Keep the public TripBrief contract unchanged and use two
// scalar date fields only for the GPT wire format.
const OpenAIModelPatchSchema = z.object({
  destination: z.string().trim().min(1).nullable(),
  startDate: z.string().regex(ISO_DATE).nullable(),
  endDate: z.string().regex(ISO_DATE).nullable(),
  groupSize: z.number().int().positive().nullable(),
  budgetTotal: z.number().positive().nullable(),
  nationality: z.string().trim().min(1).nullable(),
});

function validDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    ISO_DATE.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}

function amount(value: string): number | undefined {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function cleanDestination(value: string): string {
  return value
    .trim()
    .replace(/\s+(?:trip|travel|holiday)$/i, "")
    .replace(/[，,。.]+$/, "")
    .trim();
}

export function extractBriefPatchLocally(message: string): BriefPatch {
  const patch: BriefPatch = {};

  const dates = message.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:to|through|until|–|—|至|到)\s*(\d{4}-\d{2}-\d{2})/i,
  );
  if (dates?.[1] && dates[2]) patch.dates = [dates[1], dates[2]];

  const budget =
    message.match(
      /(?:budget|预算(?:改成|调整为|是|为)?)[^\d]{0,12}(?:USD\s*)?\$?\s*([\d,]+(?:\.\d+)?)/i,
    ) ?? message.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (budget?.[1]) patch.budgetTotal = amount(budget[1]);

  const group = message.match(/(\d+)\s*(?:people|persons?|travell?ers?|人)/i);
  if (group?.[1]) patch.groupSize = amount(group[1]);
  if (!patch.groupSize) {
    const chineseGroup = message.match(/([一二两三四五六七八九十])\s*(?:个)?人/);
    const values: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    if (chineseGroup?.[1]) patch.groupSize = values[chineseGroup[1]];
  }

  const englishDestination = message.match(
    /(?:trip|travel|holiday|go|going)\s+(?:to|in)\s+(.+?)(?=\s+(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const explicitDestination = message.match(
    /(?:destination|place)(?:\s+(?:is|to|as))?\s*[:=]?\s+(.+?)(?=\s+(?:and\s+)?(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const leadingDestination = message.match(
    /^\s*([A-Za-z][A-Za-z &.\-]+?)\s*[,，]\s*\d{4}-\d{2}-\d{2}/,
  );
  const chineseDestination = message.match(
    /(?:去|前往|目的地(?:是|为|改成|调整为)?)[：:\s]*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&·\- ]*?)(?=\s*(?:旅行|旅游|玩|，|,|。|预算|\d{4}-|$))/u,
  );
  const destination = cleanDestination(
    englishDestination?.[1] ??
      explicitDestination?.[1] ??
      leadingDestination?.[1] ??
      chineseDestination?.[1] ??
      "",
  );
  if (destination) patch.destination = destination;

  const passport =
    message.match(/([A-Za-z][A-Za-z ]+?)\s+passport/i) ??
    message.match(/([\p{Script=Han}]{2,12})护照/u);
  if (passport?.[1]) patch.nationality = passport[1].trim();

  return BriefPatchSchema.parse(patch);
}

export function applyBriefPatch(current: TripBrief, patch: BriefPatch, tripId: string): TripBrief {
  const parsedPatch = BriefPatchSchema.parse(patch);
  const next = TripBriefSchema.parse({ ...current, ...parsedPatch, tripId });
  if (!validDate(next.dates[0]) || !validDate(next.dates[1])) {
    throw new Error("Trip dates must be real dates in YYYY-MM-DD format.");
  }
  if (Date.parse(next.dates[1]) <= Date.parse(next.dates[0])) {
    throw new Error("Trip end date must be after the start date.");
  }
  return next;
}

function extractionPrompt(message: string, current: TripBrief): string {
  return `Extract only explicit updates to the trip brief. Use null for every field the user did not specify. Do not infer dates, nationality, group size, destination, or budget. Budget is total USD. Dates must be YYYY-MM-DD.\n\nCurrent brief:\n${JSON.stringify(current)}\n\nUser message:\n${message}`;
}

function createOpenAIExtractor(): BriefExtractor | undefined {
  const apiKey = process.env.GPT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  // GPT is used for short, high-precision intent extraction. `max` is accepted
  // as a product-level setting and mapped to the API's highest supported effort.
  const configuredEffort = (process.env.GPT_REASONING_EFFORT || "high").toLowerCase();
  const allowed = new Set(["low", "medium", "high", "max"]);
  const safeEffort = allowed.has(configuredEffort) ? configuredEffort : "high";
  const reasoningEffort = safeEffort === "max" ? "high" : safeEffort;
  const model = new ChatOpenAI({
    apiKey,
    model: process.env.GPT_MODEL || "gpt-5.6-luna",
    reasoning: { effort: reasoningEffort as "low" | "medium" | "high" },
    maxTokens: 512,
    streamUsage: false,
    configuration: {
      baseURL: process.env.GPT_BASE_URL || "https://api.openai.com/v1",
    },
  });
  const structured = model.withStructuredOutput(OpenAIModelPatchSchema, {
    name: "TripBriefPatch",
    method: "jsonSchema",
    strict: true,
  });
  return {
    async extract(message, current) {
      const result = await structured.invoke(extractionPrompt(message, current));
      const { startDate, endDate, ...fields } = result;
      const patch: BriefPatch = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== null) patch[key as keyof BriefPatch] = value as never;
      }
      if (startDate !== null && endDate !== null) patch.dates = [startDate, endDate];
      return BriefPatchSchema.parse(patch);
    },
  };
}

function createAnthropicExtractor(): BriefExtractor | undefined {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  const model = new ChatAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.AI_MODEL || "claude-haiku-4-5-20251001",
    temperature: 0,
  });
  const structured = model.withStructuredOutput(ModelPatchSchema, {
    name: "TripBriefPatch",
    method: "functionCalling",
    strict: true,
  });
  return {
    async extract(message, current) {
      const result = await structured.invoke(extractionPrompt(message, current));
      return BriefPatchSchema.parse(
        Object.fromEntries(Object.entries(result).filter(([, value]) => value !== null)),
      );
    },
  };
}

function createLangChainExtractor(): BriefExtractor | undefined {
  // Prefer the GPT profile for chat/intent extraction, then preserve the
  // existing Anthropic profile for teams that still configure that provider.
  return createOpenAIExtractor() ?? createAnthropicExtractor();
}

async function extractPatch(
  message: string,
  current: TripBrief,
  extractor?: BriefExtractor,
): Promise<BriefPatch> {
  const selected = extractor ?? createLangChainExtractor();
  if (selected) {
    try {
      return await selected.extract(message, current);
    } catch {
      console.warn("[chat] LangChain brief extraction failed; using the local parser.");
    }
  }
  return extractBriefPatchLocally(message);
}

function changedFields(before: TripBrief, after: TripBrief): string[] {
  return (["destination", "dates", "groupSize", "budgetTotal", "nationality"] as const).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function fallbackReplyFor(plan: ChatResponse["plan"]): string {
  const summaries = plan.sections
    .map((section) => section.summary.trim())
    .filter(Boolean)
    .slice(0, 2);
  const pending = plan.hitl.find((checkpoint) => checkpoint.status === "pending");
  const facts = pending ? [pending.detail] : [];

  return [...summaries, ...facts].join(" ") || `USD ${plan.estTotal.toFixed(2)}`;
}

export function replyPrompt(
  message: string,
  before: TripBrief,
  after: TripBrief,
  fields: string[],
  plan: ChatResponse["plan"],
): string {
  const planContext = {
    brief: after,
    previousBrief: before,
    changedFields: fields,
    round: plan.round,
    estimatedTotal: plan.estTotal,
    budgetTotal: plan.budgetTotal,
    overrunPct: plan.overrunPct,
    sections: plan.sections.map((section) => ({
      label: section.label,
      status: section.status,
      summary: section.summary,
      estimatedCost: section.estCost,
    })),
    pendingHumanDecisions: plan.hitl
      .filter((checkpoint) => checkpoint.status === "pending")
      .map((checkpoint) => ({ title: checkpoint.title, detail: checkpoint.detail })),
  };

  return `You are the trip coordinator speaking directly to a traveler. Write one warm, natural reply to the user's latest message after reviewing the updated trip plan.

Communication rules:
- Detect the language of the traveler's latest message and reply in that exact same language. Do not default to English, translate unnecessarily, or mix languages.
- Acknowledge what the traveler asked for before giving the useful result.
- Be concise but personable (2-4 short sentences); sound like a thoughtful human travel partner, not a status template.
- Mention only facts supported by the plan context below. Never invent bookings, prices, availability, or certainty.
- If something still needs the traveler's decision, explain the most important next choice in plain language.
- Do not mention prompts, models, agents, orchestration, internal rounds, chain-of-thought, or implementation details.
- Do not use a fixed 'Updated: ...' or 'The plan completed...' formula. Vary the wording naturally.

Traveler's latest message:
${message}

Plan context (JSON):
${JSON.stringify(planContext)}

Return only the reply text. Do not add a heading or a JSON object.`;
}

function createReplyGenerator(): ReplyGenerator | undefined {
  const model = createRoutedChatModel("itinerary");
  if (!model) return undefined;
  return {
    async generate(prompt) {
      const response = await model.invoke(prompt);
      if (typeof response.content === "string") {
        const text = response.content.trim();
        if (text) return text;
      }
      if (Array.isArray(response.content)) {
        const text = response.content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object" && "text" in part) return String(part.text);
            return "";
          })
          .join("")
          .trim();
        if (text) return text;
      }
      throw new Error("Reply model returned no text.");
    },
  };
}

export async function runTripChat(
  request: ChatRequest,
  options: TripChatOptions = {},
): Promise<ChatResponse> {
  const { extractor, replyGenerator, ...orchestrationOptions } = options;
  const current = TripBriefSchema.parse({
    ...(request.brief ?? DEMO_BRIEF),
    tripId: request.tripId,
  });
  const patch = await extractPatch(request.message, current, extractor);
  const brief = applyBriefPatch(current, patch, request.tripId);
  const mem: MemoryStore = orchestrationOptions.mem ?? memory;
  await mem.appendShortTerm(
    request.tripId,
    ChatTurn.parse({ role: "user", content: request.message }),
  );
  const plan = await runOrchestrator(brief, {
    ...orchestrationOptions,
    mem,
    decisions: request.decisions,
  });
  const fields = changedFields(current, brief);
  const generator = replyGenerator ?? createReplyGenerator();
  let reply = fallbackReplyFor(plan);
  if (generator) {
    try {
      reply = await generator.generate(replyPrompt(request.message, current, brief, fields, plan));
    } catch (error) {
      console.warn(
        `[chat] natural-language reply failed; using a local fallback: ${
          error instanceof Error ? error.message : "unknown reply error"
        }`,
      );
    }
  }
  await mem.appendShortTerm(request.tripId, ChatTurn.parse({ role: "assistant", content: reply }));
  return { reply, plan };
}
