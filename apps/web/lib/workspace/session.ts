import type {
  AgentProgressEvent,
  AssistantId,
  AskUserQuestionItem,
  ChatRequest,
  FlightAnswer,
  PartialTripBrief,
  TripPlan,
} from "@trip/shared";
import { keepDayNotes } from "@/lib/trip/day-actions";
import { validSelectedStop } from "./browsing";
import { errorNotice, type Notice } from "@/lib/i18n/notice";
import type { RouteResult } from "@/lib/integrations/google";
import type { PendingAsk, QuestionProgress } from "./ask-user";
import {
  AskUserError,
  FlightAnswerError,
  NeedsInfoError,
  draftFor,
  draftWithKnown,
  identifyActivities,
  readPlanStream,
  sameDraft,
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
  status: "idle" | "running" | "stopped" | "failed";

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
  | {
      kind: "planned";
      plan: TripPlan;
      reply: string;
      assistant?: AssistantId;
      transcript: AgentProgressEvent[];
      at: number;
      memoryChange?: import("@trip/shared").ChatResponse["memoryChange"];
    }
  | {
      kind: "needsInfo";
      question: string;
      known: PartialTripBrief;
      assistant?: AssistantId;
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
  | { kind: "rewound"; index: number }
  | { kind: "progress"; event: AgentProgressEvent }
  | { kind: "rejected"; fields: Record<string, Notice> }
  | { kind: "opened"; saved: SavedSession }
  | { kind: "edited"; plan: TripPlan }
  | { kind: "typed"; input: string }
  | { kind: "drafted"; draft: Draft }
  | { kind: "defaults-changed"; previous: Draft; next: Draft }
  | { kind: "selected"; activity: string | undefined }
  | { kind: "routed"; routes: RouteResult[] }
  | { kind: "dismissed" }
  | { kind: "askProgress"; progress: QuestionProgress }
  | { kind: "estimateDismissed" }
  | { kind: "timelineChanged"; changed: boolean }
  | { kind: "planConflict"; outcome: Extract<TurnOutcome, { kind: "planned" }>; notice: Notice }
  | {
      kind: "taskRestored";
      status: "running" | "stopped" | "failed";
      activity: AgentProgressEvent[];
      error?: Notice;
      retry?: Task;
    }
  | { kind: "replacedDismissed" };

export const PREPARING_SUMMARY = "Preparing your request.";

export const PREPARING: AgentProgressEvent = {
  type: "coordinator",
  phase: "dispatch",
  round: 1,
  summary: PREPARING_SUMMARY,
};

export const REJECTED_BRIEF: Notice = { key: "checkTheHighlightedTripDetails" };
const FAILED: Notice = { key: "unableToUpdateTheTrip" };

export type SavedSession = Pick<SessionState, "draft" | "messages" | "input"> &
  Partial<Pick<SessionState, "plan" | "previousTotal" | "ask" | "selectedActivity">>;

export function idleSession(saved: SavedSession): SessionState {
  return {
    plan: saved.plan,
    draft: saved.draft,
    messages: saved.messages,
    input: saved.input,
    previousTotal: saved.previousTotal,
    busy: false,
    status: "idle",
    activity: [],
    error: undefined,
    errors: {},
    retry: undefined,
    ask: saved.ask,
    selectedActivity: saved.selectedActivity,
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
    status: "idle",
    ask: undefined,
  };
}

export function mergeRoutes(kept: RouteResult[], fresh: RouteResult[]): RouteResult[] {
  if (!fresh.length) return kept;
  const byPair = new Map(kept.map((route) => [`${route.from}>${route.to}`, route]));
  for (const route of fresh) byPair.set(`${route.from}>${route.to}`, route);
  return [...byPair.values()];
}

function sameDates(previous: TripPlan | undefined, next: TripPlan): boolean {
  return (
    !previous ||
    (previous.brief.dates[0] === next.brief.dates[0] &&
      previous.brief.dates[1] === next.brief.dates[1])
  );
}

function estimateMoved(previous: TripPlan | undefined, next: TripPlan) {
  const change = previous ? next.estTotal - previous.estTotal : 0;
  return Math.abs(change) < 0.005 ? undefined : change;
}

export function session(state: SessionState, event: SessionEvent): SessionState {
  switch (event.kind) {
    case "started":
      return {
        ...state,
        busy: true,
        status: "running",
        input: "",
        error: undefined,
        retry: undefined,
        activity: [PREPARING],
      };
    case "sent":
      return {
        ...state,
        messages: [...state.messages, event.message],
        ...(event.brief ? { errors: {} } : {}),
      };
    case "rewound":
      return { ...state, messages: state.messages.slice(0, event.index) };
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
    case "defaults-changed":
      return !state.plan &&
        !state.messages.length &&
        !state.input.trim() &&
        sameDraft(state.draft, event.previous)
        ? { ...state, draft: event.next }
        : state;
    case "selected":
      return { ...state, selectedActivity: event.activity };
    case "routed":
      return { ...state, mapRoutes: mergeRoutes(state.mapRoutes, event.routes) };
    case "dismissed":
      return { ...state, ask: undefined };
    case "askProgress":
      return state.ask ? { ...state, ask: { ...state.ask, progress: event.progress } } : state;
    case "edited":
      return {
        ...state,
        previousTotal: state.plan?.estTotal,
        plan: event.plan,
        draft: sameDates(state.plan, event.plan)
          ? state.draft
          : { ...state.draft, start: event.plan.brief.dates[0], end: event.plan.brief.dates[1] },
        selectedActivity: validSelectedStop(event.plan, state.selectedActivity),
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
    case "planConflict":
      return replied(
        state,
        reply(event.outcome.reply, event.outcome.transcript, event.outcome.at, {
          conflictNotice: event.notice,
        }),
      );
    case "taskRestored":
      return {
        ...state,
        busy: event.status === "running",
        status: event.status,
        activity: event.activity,
        error: event.error,
        retry: event.retry,
      };
    case "planned":
      return {
        ...replied(
          state,
          reply(event.reply, event.transcript, event.at, {
            outcome: "planned",
            ...(event.memoryChange ? { memoryChange: event.memoryChange } : {}),
            ...(event.assistant ? { assistant: event.assistant } : {}),
          }),
        ),
        previousTotal: state.plan?.estTotal,

        estimateChange: estimateMoved(state.plan, event.plan),

        replacedChange: state.timelineChanges && state.plan ? true : undefined,
        timelineChanges: undefined,
        plan: keepDayNotes(identifyActivities(event.plan), state.plan),
        draft: draftFor(event.plan.brief),
        selectedActivity:
          state.plan?.tripId === event.plan.tripId
            ? validSelectedStop(event.plan, state.selectedActivity)
            : undefined,
        mapRoutes: [],
        errors: {},
      };
    case "needsInfo":
      return {
        ...replied(
          state,
          reply(event.question, event.transcript, event.at, {
            outcome: "asked",
            ...(event.assistant ? { assistant: event.assistant } : {}),
          }),
        ),
        draft: draftWithKnown(state.draft, event.known),
      };
    case "asked": {
      const text = event.reply?.trim() || event.questions.map((item) => item.question).join("\n\n");
      return {
        ...replied(state, reply(text, event.transcript, event.at, { outcome: "asked" })),

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
      return {
        ...state,
        busy: false,
        status: "failed",
        input: state.input || event.task.request.message,
        error: event.message,
        retry: event.task,
      };
    case "cancelled":
      return { ...state, busy: false, status: "stopped", error: undefined, retry: undefined };
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
    return {
      kind: "planned",
      plan: result.plan,
      reply: result.reply,
      ...(result.assistant ? { assistant: result.assistant } : {}),
      transcript,
      at: now(),
      ...(result.memoryChange ? { memoryChange: result.memoryChange } : {}),
    };
  } catch (failure) {
    if (signal.aborted) return { kind: "cancelled" };
    if (failure instanceof FlightAnswerError)
      return { kind: "answered", flights: failure.answer, transcript, at: now() };
    if (failure instanceof NeedsInfoError) {
      const { question, known, assistant } = failure.needsInfo;
      return {
        kind: "needsInfo",
        question,
        known,
        ...(assistant ? { assistant } : {}),
        transcript,
        at: now(),
      };
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
