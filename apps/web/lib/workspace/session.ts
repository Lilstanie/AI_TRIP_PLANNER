import type {
  AgentProgressEvent,
  AskUserQuestionItem,
  ChatRequest,
  FlightAnswer,
  PartialTripBrief,
  TripPlan,
} from "@trip/shared";
import { errorNotice, type Notice } from "@/lib/i18n/notice";
import type { RouteResult } from "@/lib/integrations/google";
import type { PendingAsk } from "./ask-user";
import {
  AskUserError,
  FlightAnswerError,
  NeedsInfoError,
  draftFor,
  draftWithKnown,
  identifyActivities,
  readPlanStream,
  type Draft,
  type Message,
} from "./workspace";

export type Task = { kind: "chat"; request: ChatRequest };

export type SessionState = {
  plan: TripPlan | undefined;
  draft: Draft;
  messages: Message[];

  input: string;

  previousTotal: number | undefined;
  busy: boolean;

  activity: AgentProgressEvent[];

  error: Notice | undefined;

  errors: Record<string, Notice>;

  retry: Task | undefined;

  ask: PendingAsk | undefined;

  selectedActivity: string | undefined;

  mapRoutes: RouteResult[];

  estimateChange: number | undefined;

  timelineChanges?: number;

  replacedChange?: boolean;
};

export type TurnOutcome =
  | { kind: "planned"; plan: TripPlan; reply: string; transcript: AgentProgressEvent[]; at: number }
  | {
      kind: "needsInfo";
      question: string;
      known: PartialTripBrief;
      transcript: AgentProgressEvent[];
      at: number;
    }
  | {
      kind: "asked";
      key: string;
      questions: AskUserQuestionItem[];
      known: PartialTripBrief;
      plan?: TripPlan;
      reply?: string;
      transcript: AgentProgressEvent[];
      at: number;
    }
  | { kind: "answered"; flights: FlightAnswer; transcript: AgentProgressEvent[]; at: number }
  | { kind: "failed"; message: Notice; task: Task }
  | { kind: "cancelled" };

export type SessionEvent =
  | TurnOutcome
  | { kind: "started" }
  | { kind: "sent"; message: Message; brief?: boolean }
  | { kind: "progress"; event: AgentProgressEvent }
  | { kind: "rejected"; fields: Record<string, Notice> }
  | { kind: "opened"; saved: SavedSession }
  | { kind: "edited"; plan: TripPlan }
  | { kind: "typed"; input: string }
  | { kind: "drafted"; draft: Draft }
  | { kind: "selected"; activity: string | undefined }
  | { kind: "routed"; routes: RouteResult[] }
  | { kind: "dismissed" }
  | { kind: "estimateDismissed" }
  | { kind: "timelineChanged"; changed: boolean }
  | { kind: "replacedDismissed" };

export const PREPARING: AgentProgressEvent = {
  type: "coordinator",
  phase: "dispatch",
  round: 1,
  summary: "Preparing your request.",
};

export const REJECTED_BRIEF: Notice = { key: "Check the highlighted trip details." };
const FAILED: Notice = { key: "Unable to update the trip. Please retry." };

export type SavedSession = Pick<SessionState, "draft" | "messages" | "input"> &
  Partial<Pick<SessionState, "plan" | "previousTotal">>;

export function idleSession(saved: SavedSession): SessionState {
  return {
    plan: saved.plan,
    draft: saved.draft,
    messages: saved.messages,
    input: saved.input,
    previousTotal: saved.previousTotal,
    busy: false,
    activity: [],
    error: undefined,
    errors: {},
    retry: undefined,
    ask: undefined,
    selectedActivity: undefined,
    mapRoutes: [],
    estimateChange: undefined,
  };
}

function reply(
  text: string,
  transcript: AgentProgressEvent[],
  at: number,
  extra: Partial<Message> = {},
): Message {
  return {
    role: "agent",
    text,
    ...extra,
    at,
    ...(transcript.length > 1 ? { activity: [...transcript] } : {}),
  };
}

function replied(state: SessionState, message: Message): SessionState {
  return {
    ...state,
    messages: [...state.messages, message],
    input: "",
    activity: [],
    busy: false,
  };
}

export function mergeRoutes(kept: RouteResult[], fresh: RouteResult[]): RouteResult[] {
  if (!fresh.length) return kept;
  const byPair = new Map(kept.map((route) => [`${route.from}>${route.to}`, route]));
  for (const route of fresh) byPair.set(`${route.from}>${route.to}`, route);
  return [...byPair.values()];
}

export function session(state: SessionState, event: SessionEvent): SessionState {
  switch (event.kind) {
    case "started":
      return {
        ...state,
        busy: true,
        error: undefined,
        retry: undefined,
        ask: undefined,
        activity: [PREPARING],
      };
    case "sent":
      return {
        ...state,
        messages: [...state.messages, event.message],
        ...(event.brief ? { errors: {} } : {}),
      };
    case "progress":
      return { ...state, activity: [...state.activity, event.event] };
    case "rejected":
      return { ...state, errors: event.fields, error: REJECTED_BRIEF };
    case "opened":
      return idleSession(event.saved);
    case "typed":
      return { ...state, input: event.input };
    case "drafted":
      return { ...state, draft: event.draft };
    case "selected":
      return { ...state, selectedActivity: event.activity };
    case "routed":
      return { ...state, mapRoutes: mergeRoutes(state.mapRoutes, event.routes) };
    case "dismissed":
      return { ...state, ask: undefined };
    case "edited":
      return {
        ...state,
        previousTotal: state.plan?.estTotal,
        plan: event.plan,
        estimateChange: undefined,
      };
    case "estimateDismissed":
      return { ...state, estimateChange: undefined };
    case "timelineChanged": {
      const changes = Math.max(0, (state.timelineChanges ?? 0) + (event.changed ? 1 : -1));
      return { ...state, timelineChanges: changes || undefined };
    }
    case "replacedDismissed":
      return { ...state, replacedChange: undefined };
    case "planned":
      return {
        ...replied(state, reply(event.reply, event.transcript, event.at)),
        previousTotal: state.plan?.estTotal,

        estimateChange: state.plan ? event.plan.estTotal - state.plan.estTotal : undefined,

        replacedChange: state.timelineChanges && state.plan ? true : undefined,
        timelineChanges: undefined,
        plan: identifyActivities(event.plan),
        draft: draftFor(event.plan.brief),
        selectedActivity: undefined,
        mapRoutes: [],
        errors: {},
      };
    case "needsInfo":
      return {
        ...replied(state, reply(event.question, event.transcript, event.at)),
        draft: draftWithKnown(state.draft, event.known),
      };
    case "asked": {
      const text = event.reply?.trim() || event.questions.map((item) => item.question).join("\n\n");
      return {
        ...replied(state, reply(text, event.transcript, event.at)),

        ...(event.plan ? {} : { draft: draftWithKnown(state.draft, event.known) }),
        ask: {
          key: event.key,
          questions: event.questions,
          known: event.known,
          ...(event.plan ? { plan: event.plan } : {}),
        },
      };
    }
    case "answered":
      return replied(
        state,
        reply(event.flights.reply, event.transcript, event.at, { flights: event.flights }),
      );
    case "failed":
      return { ...state, busy: false, error: event.message, retry: event.task };
    case "cancelled":
      return { ...state, busy: false };
  }
}

export async function requestTurn(
  task: Task,
  send: (signal: AbortSignal) => Promise<Response>,
  {
    signal,
    onProgress,
    now = Date.now,
    newKey = () => crypto.randomUUID(),
  }: {
    signal: AbortSignal;
    onProgress?: (event: AgentProgressEvent) => void;
    now?: () => number;
    newKey?: () => string;
  },
): Promise<TurnOutcome> {
  const transcript: AgentProgressEvent[] = [PREPARING];
  try {
    const response = await send(signal);
    const result = await readPlanStream(response, (event) => {
      transcript.push(event);
      onProgress?.(event);
    });
    return { kind: "planned", plan: result.plan, reply: result.reply, transcript, at: now() };
  } catch (failure) {
    if (signal.aborted) return { kind: "cancelled" };
    if (failure instanceof FlightAnswerError)
      return { kind: "answered", flights: failure.answer, transcript, at: now() };
    if (failure instanceof NeedsInfoError) {
      const { question, known } = failure.needsInfo;
      return { kind: "needsInfo", question, known, transcript, at: now() };
    }
    if (failure instanceof AskUserError) {
      const { questions, known, plan, reply: text } = failure.askUser;
      return {
        kind: "asked",
        key: newKey(),
        questions,
        known,
        ...(plan ? { plan } : {}),
        ...(text !== undefined ? { reply: text } : {}),
        transcript,
        at: now(),
      };
    }
    return {
      kind: "failed",

      message: errorNotice(failure, FAILED),
      task,
    };
  }
}
