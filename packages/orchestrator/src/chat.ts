import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { memory } from "@trip/services";
import { deepSeekReasoningEffort, deepSeekThinkingEnabled } from "@trip/agents";
import {
  ChatTurn,
  completeTripBrief,
  TripIntakeDraft as TripIntakeDraftSchema,
  TripIntakeResponse,
  TripBrief as TripBriefSchema,
  type ChatRequest,
  type ChatResponse,
  type ChatRunProgress,
  type TripIntakeRequest,
  type TripIntakeResponse as TripIntakeResponseType,
  type MemoryStore,
  type TokenUsage,
  type TripBrief,
} from "@trip/shared";
import { z } from "zod/v4";
import { runOrchestrator, type OrchestratorOptions } from "./workflow";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GREETING = /^(?:hi|hello|hey|hiya|你好|您好|嗨|哈喽)(?:\s+there)?[!,.。！？，?\s]*$/iu;

export function isGreeting(message: string): boolean {
  return GREETING.test(message.trim());
}

function dateFromNow(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function starterBrief(tripId: string): TripBrief {
  return TripBriefSchema.parse({
    tripId,
    userId: "demo-user",
    destination: "Destination not set",
    dates: [dateFromNow(30), dateFromNow(35)],
    groupSize: 1,
    budgetTotal: 3000,
  });
}

function bareDestination(message: string): string | undefined {
  const value = message
    .trim()
    .replace(/[.!?。！？]+$/, "")
    .trim();
  if (isGreeting(value)) return undefined;
  if (
    value.length > 60 ||
    /\d/.test(value) ||
    value.split(/\s+/).length > 4 ||
    /\b(?:plan|trip|travel|holiday|budget|people|person|date|when|help|please)\b/i.test(value) ||
    /(?:旅行|旅游|预算|日期|几人|帮我|计划)/u.test(value)
  ) {
    return undefined;
  }
  return /^[\p{L}\p{M}][\p{L}\p{M} &'·.\-]*$/u.test(value) ? value : undefined;
}

function contextualIntakePatch(
  message: string,
  draft: TripIntakeResponseType["draft"],
): BriefPatch {
  const value = message
    .trim()
    .replace(/[.!?。！？]+$/, "")
    .trim();
  if (!draft.groupSize && /^\d+$/.test(value)) {
    return { groupSize: Number(value) };
  }
  if (!draft.budgetTotal && /^\$?[\d,]+(?:\.\d+)?$/.test(value)) {
    return { budgetTotal: Number(value.replace(/[\$,]/g, "")) };
  }
  return {};
}

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

export interface TripChatOptions extends OrchestratorOptions {
  extractor?: BriefExtractor;
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
  if (!patch.dates) {
    const relative = message.match(/(?:tomorrow|明天).*?(\d+)\s*(?:days?|天)/i);
    if (relative?.[1]) {
      const duration = Number(relative[1]);
      if (Number.isSafeInteger(duration) && duration > 0 && duration <= 90) {
        patch.dates = [dateFromNow(1), dateFromNow(duration + 1)];
      }
    }
  }

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

/**
 * DeepSeek is the default configured provider in this project. Its thinking
 * mode returns reasoning separately and is most reliable with an `auto` tool
 * call rather than LangChain's forced structured-output tool choice.
 */
function createDeepSeekExtractor(): BriefExtractor | undefined {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return undefined;
  const thinking = deepSeekThinkingEnabled();
  const model = new ChatOpenAI({
    apiKey,
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    ...(thinking ? {} : { temperature: 0 }),
    streamUsage: false,
    modelKwargs: thinking
      ? { thinking: { type: "enabled" }, reasoning_effort: deepSeekReasoningEffort() }
      : { thinking: { type: "disabled" } },
    configuration: {
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    },
  });
  const bound = model.bindTools(
    [
      {
        type: "function",
        function: {
          name: "TripBriefPatch",
          description: "Return only explicit trip brief updates.",
          parameters: z.toJSONSchema(ModelPatchSchema, { io: "input", target: "draft-7" }),
        },
      },
    ],
    { tool_choice: "auto" },
  );
  return {
    async extract(message, current) {
      const response = await bound.invoke(extractionPrompt(message, current));
      const call = response.tool_calls?.find((toolCall) => toolCall.name === "TripBriefPatch");
      if (!call) throw new Error("DeepSeek returned no TripBriefPatch tool call");
      const result = ModelPatchSchema.parse(call.args);
      const { dates, ...fields } = result;
      const patch: BriefPatch = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== null),
      );
      if (dates !== null) patch.dates = dates;
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
  return createOpenAIExtractor() ?? createAnthropicExtractor() ?? createDeepSeekExtractor();
}

function configuredExtractorModel(extractor?: BriefExtractor): string {
  if (extractor) return "Injected extractor";
  if (process.env.GPT_API_KEY || process.env.OPENAI_API_KEY) {
    return `OpenAI · ${process.env.GPT_MODEL || "gpt-5.6-luna"}`;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return `Anthropic · ${process.env.AI_MODEL || "claude-haiku-4-5-20251001"}`;
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return `DeepSeek · ${process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"}${deepSeekThinkingEnabled() ? " · thinking" : ""}`;
  }
  return "Local parser";
}

async function extractPatch(
  message: string,
  current: TripBrief,
  extractor?: BriefExtractor,
): Promise<{ patch: BriefPatch; model: string; usage: TokenUsage | null }> {
  const selected = extractor ?? createLangChainExtractor();
  const selectedModel = configuredExtractorModel(extractor);
  if (selected) {
    try {
      return { patch: await selected.extract(message, current), model: selectedModel, usage: null };
    } catch {
      console.warn("[chat] LangChain brief extraction failed; using the local parser.");
      return {
        patch: extractBriefPatchLocally(message),
        model: `Local parser (fallback from ${selectedModel})`,
        // The failed provider request may have consumed tokens, but its
        // structured adapter did not expose usage metadata.
        usage: null,
      };
    }
  }
  return {
    patch: extractBriefPatchLocally(message),
    model: "Local parser",
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}

function changedFields(before: TripBrief, after: TripBrief): string[] {
  return (["destination", "dates", "groupSize", "budgetTotal", "nationality"] as const).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function replyFor(message: string, fields: string[], plan: ChatResponse["plan"]): string {
  const chinese = /\p{Script=Han}/u.test(message);
  if (chinese) {
    const update = fields.length
      ? `已更新：${fields.join("、")}。`
      : "没有识别到明确的新字段，已保留现有需求。";
    return `${update}规划在第 ${plan.round} 轮完成，预计总价 USD ${plan.estTotal.toFixed(2)}。`;
  }
  const update = fields.length
    ? `Updated: ${fields.join(", ")}.`
    : "I could not find an explicit trip-field update, so I kept the current brief.";
  return `${update} The plan completed in round ${plan.round} at an estimated USD ${plan.estTotal.toFixed(2)}.`;
}

function intakeQuestion(draft: TripIntakeResponseType["draft"]): string {
  if (!draft.destination) {
    return "What destination would you like to visit? You can name a city, region, or country.";
  }
  if (!draft.dates) {
    return `What dates would you like to travel to ${draft.destination}? If your dates are flexible, give me an approximate window.`;
  }
  if (!draft.groupSize) {
    return "How many travellers are going? Let me know if there are children or accessibility needs too.";
  }
  if (!draft.budgetTotal) {
    return "What is your total trip budget, and which currency should I use?";
  }
  return "I have the core trip details. Are there any must-see interests, dietary needs, or pace preferences I should account for?";
}

function greetingReply(message: string, draft: TripIntakeResponseType["draft"]): string {
  if (/\p{Script=Han}/u.test(message)) {
    return draft.destination
      ? `你好！我可以继续帮你完善${draft.destination}的行程。你想修改日期、人数还是预算？`
      : "你好！我可以帮你规划旅行。先告诉我想去哪里，例如“我想去东京”。";
  }
  return draft.destination
    ? `Hi! I can keep helping with your ${draft.destination} trip. What would you like to change?`
    : "Hi! I can help plan your trip. Where would you like to go?";
}

/**
 * The conversational intake agent. It decides after every message whether the
 * brief has enough grounding for the planner, rather than making the browser
 * follow a fixed question sequence.
 */
export async function runTripIntake(
  request: TripIntakeRequest,
  options: TripChatOptions = {},
): Promise<TripIntakeResponseType> {
  const draft = TripIntakeDraftSchema.parse(request.draft ?? { tripId: request.tripId });
  if (isGreeting(request.message)) {
    return TripIntakeResponse.parse({
      reply: greetingReply(request.message, draft),
      draft,
      ready: false,
      plan: null,
    });
  }
  const current = TripBriefSchema.parse({
    ...starterBrief(request.tripId),
    ...draft,
    tripId: request.tripId,
  });
  const extracted = await extractPatch(request.message, current, options.extractor);
  Object.assign(extracted.patch, contextualIntakePatch(request.message, draft));
  if (!extracted.patch.destination) {
    const destination = bareDestination(request.message);
    if (destination) extracted.patch.destination = destination;
  }
  const nextDraft = TripIntakeDraftSchema.parse({
    ...draft,
    ...extracted.patch,
    tripId: request.tripId,
  });
  const brief = completeTripBrief(nextDraft);
  if (!brief) {
    return TripIntakeResponse.parse({
      reply: intakeQuestion(nextDraft),
      draft: nextDraft,
      ready: false,
      plan: null,
    });
  }

  const planned = await runTripChat(
    {
      tripId: request.tripId,
      message: request.message,
      brief,
      history: request.history,
    },
    options,
  );
  return TripIntakeResponse.parse({
    reply: `Your trip details are complete. The plan is ready for review at an estimated USD ${planned.plan.estTotal.toFixed(2)}.`,
    draft: nextDraft,
    ready: true,
    plan: planned.plan,
  });
}

export async function runTripChat(
  request: ChatRequest,
  options: TripChatOptions = {},
): Promise<ChatResponse> {
  const { extractor, onProgress, ...orchestrationOptions } = options;
  const report = (progress: ChatRunProgress) => {
    try {
      onProgress?.(progress);
    } catch {
      // Progress reporting is optional and must not affect the answer.
    }
  };
  const firstMessage = request.brief === undefined;
  const current = TripBriefSchema.parse({
    ...(request.brief ?? starterBrief(request.tripId)),
    tripId: request.tripId,
  });
  const coordinatorModel = configuredExtractorModel(extractor);
  report({
    phase: "decomposing",
    message: "Extracting explicit trip changes and preserving existing constraints",
    agent: {
      id: "coordinator",
      label: "Trip coordinator",
      status: "running",
      model: coordinatorModel,
      usage:
        coordinatorModel === "Local parser"
          ? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
          : null,
    },
  });
  const extracted = await extractPatch(request.message, current, extractor);
  if (firstMessage && !extracted.patch.destination) {
    const destination = bareDestination(request.message);
    if (destination) extracted.patch.destination = destination;
  }
  if (firstMessage && !extracted.patch.destination) {
    throw new Error("Tell me a destination to start your trip.");
  }
  report({
    phase: "decomposing",
    message: "Trip changes decomposed into specialist tasks",
    agent: {
      id: "coordinator",
      label: "Trip coordinator",
      status: "completed",
      model: extracted.model,
      usage: extracted.usage,
    },
  });
  const patch = extracted.patch;
  const brief = applyBriefPatch(current, patch, request.tripId);
  const mem: MemoryStore = orchestrationOptions.mem ?? memory;
  const existingTrip = await mem.getTrip?.(request.tripId);
  const now = new Date().toISOString();
  await mem.saveTrip?.({
    tripId: request.tripId,
    userId: brief.userId,
    title: brief.destination,
    createdAt: existingTrip?.createdAt ?? now,
    updatedAt: now,
    plan: existingTrip?.plan ?? null,
  });
  for (const turn of request.history ?? []) {
    await mem.appendShortTerm(request.tripId, ChatTurn.parse(turn));
  }
  await mem.appendShortTerm(
    request.tripId,
    ChatTurn.parse({ role: "user", content: request.message }),
  );
  const plan = await runOrchestrator(brief, { ...orchestrationOptions, mem, onProgress: report });
  const reply = request.history?.length
    ? `Your trip details are complete. The plan is ready for review at an estimated USD ${plan.estTotal.toFixed(2)}.`
    : replyFor(request.message, changedFields(current, brief), plan);
  await mem.appendShortTerm(request.tripId, ChatTurn.parse({ role: "assistant", content: reply }));
  await mem.saveTrip?.({
    tripId: request.tripId,
    userId: brief.userId,
    title: brief.destination,
    createdAt: existingTrip?.createdAt ?? now,
    updatedAt: new Date().toISOString(),
    plan,
  });
  report({ phase: "complete", message: `Plan ${plan.planVersion.slice(0, 8)} is ready to review` });
  return { reply, plan };
}
