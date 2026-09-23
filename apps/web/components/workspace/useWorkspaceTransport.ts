"use client";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { TripPlan, type AgentProgressEvent, type Attachment } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import {
  identifyActivities,
  draftFor,
  draftWithKnown,
  knownFromDraft,
  money,
  parseDraft,
  readPlanStream,
  AskUserError,
  FlightAnswerError,
  NeedsInfoError,
  type Draft,
  type Message,
} from "@/lib/workspace";
import type { Task } from "./workspace-helpers";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import { formatAskAnswers, type PendingAsk, type QuestionAnswer } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import { storedAttachments } from "./useComposerAttachments";
import { briefErrors } from "@/lib/workspace/trip-facts";

type WorkspaceTransportOptions = {
  plan: TripPlan | undefined;
  /** Fixtures or real providers; travels with each planning request. */
  dataMode: DataMode | undefined;
  draft: Draft;
  input: string;
  planRef: MutableRefObject<TripPlan | undefined>;
  freshTripId: MutableRefObject<string>;
  active: MutableRefObject<AbortController | null>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setActivity: Dispatch<SetStateAction<AgentProgressEvent[]>>;
  setError: Dispatch<SetStateAction<string>>;
  setRetry: Dispatch<SetStateAction<Task | undefined>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  setPreviousTotal: Dispatch<SetStateAction<number | undefined>>;
  setPlan: Dispatch<SetStateAction<TripPlan | undefined>>;
  setDraft: Dispatch<SetStateAction<Draft>>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedActivity: Dispatch<SetStateAction<string | undefined>>;
  setMapRoutes: Dispatch<SetStateAction<RouteResult[]>>;
  /** Files the composer is holding for the next message. */
  attachments: PreparedAttachment[];
  /** Drops the held files once they have left with a message. */
  clearAttachments(): void;
  /** The structured question awaiting an answer, if the coordinator asked one. */
  ask: PendingAsk | undefined;
  setAsk: Dispatch<SetStateAction<PendingAsk | undefined>>;
  /** A submission was rejected; `fields` holds one message per invalid field. */
  onReject(fields: Record<string, string>): void;
};

export function useWorkspaceTransport({
  plan,
  draft,
  input,
  planRef,
  freshTripId,
  active,
  setBusy,
  setActivity,
  setError,
  setRetry,
  setMessages,
  setInput,
  setPreviousTotal,
  setPlan,
  setDraft,
  setErrors,
  setSelectedActivity,
  setMapRoutes,
  attachments,
  clearAttachments,
  ask,
  setAsk,
  onReject,
  dataMode,
}: WorkspaceTransportOptions) {
  async function run(task: Task) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setRetry(undefined);
    // Any new request supersedes an unanswered question.
    setAsk(undefined);
    // The turn's transcript is collected here as well as in state, so the reply
    // that ends the turn can carry it and render its Think fold above the answer.
    const turn: AgentProgressEvent[] = [
      { type: "coordinator", phase: "dispatch", round: 1, summary: "Preparing your request." },
    ];
    const withTurn = (message: Message): Message =>
      turn.length > 1 ? { ...message, activity: [...turn] } : message;
    setActivity([...turn]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...dataModeHeaders(dataMode) },
        body: JSON.stringify(task.request),
        signal: controller.signal,
      });
      const result = await readPlanStream(response, (event) => {
        if (active.current !== controller) return;
        turn.push(event);
        setActivity((events) => [...events, event]);
      });
      const next = result.plan;
      // A New chat or history switch replaced this request; its answer belongs nowhere.
      if (active.current !== controller) return;
      setMessages((current) => [
        ...current,
        withTurn({ role: "agent", text: result.reply, at: Date.now() }),
      ]);
      setActivity([]);
      setInput("");
      const before = planRef.current;
      setPreviousTotal(before?.estTotal);
      setPlan(identifyActivities(next));
      setDraft(draftFor(next.brief));
      setSelectedActivity(undefined);
      setMapRoutes([]);
      setErrors({});
    } catch (failure) {
      if (active.current !== controller || controller.signal.aborted) return;
      // A fare question answered: the reply and its fares belong in the chat,
      // and the trip that was already open stays exactly as it was.
      if (failure instanceof FlightAnswerError) {
        setMessages((current) => [
          ...current,
          withTurn({
            role: "agent",
            text: failure.answer.reply,
            flights: failure.answer,
            at: Date.now(),
          }),
        ]);
        setInput("");
        setActivity([]);
        return;
      }
      // Not enough to plan yet: the assistant asks for the rest in its own words
      // in the chat, and what it already understood goes into the preferences
      // form and travels with the next message.
      if (failure instanceof NeedsInfoError) {
        setMessages((current) => [
          ...current,
          withTurn({ role: "agent", text: failure.needsInfo.question, at: Date.now() }),
        ]);
        setDraft((current) => draftWithKnown(current, failure.needsInfo.known));
        setInput("");
        setActivity([]);
        return;
      }
      // A structured question: its prose goes in the chat, the question card takes the
      // composer's seat, and the open trip stays exactly as it was.
      if (failure instanceof AskUserError) {
        const { questions, known, plan: askedAbout, reply } = failure.askUser;
        const text = reply?.trim() || questions.map((item) => item.question).join("\n\n");
        setMessages((current) => [...current, withTurn({ role: "agent", text, at: Date.now() })]);
        if (!askedAbout) setDraft((current) => draftWithKnown(current, known));
        setAsk({
          key: crypto.randomUUID(),
          questions,
          known,
          ...(askedAbout ? { plan: askedAbout } : {}),
        });
        setInput("");
        setActivity([]);
        return;
      }
      setError(
        failure instanceof Error ? failure.message : "Unable to update the trip. Please retry.",
      );
      setRetry(task);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  /** Plans with the whole brief. `next` is a chip's edit that React state has not flushed yet.
   *  Returns false when nothing was sent: a request is running, or the brief was rejected. */
  function submit(next: Draft = draft): boolean {
    if (active.current) return false;
    const parsed = parseDraft(next, plan?.brief ?? { tripId: freshTripId.current });
    if (!parsed.success) {
      const fields = briefErrors(parsed.error.issues);
      setErrors(fields);
      setError("Check the highlighted trip details.");
      onReject(fields);
      return false;
    }
    setErrors({});
    const brief = parsed.data;
    const message = `Plan ${brief.destination}, ${brief.dates.join(" to ")}, ${brief.groupSize} travellers, ${money(brief.budgetTotal)} total, with the submitted accommodation preferences.`;
    setMessages((current) => [...current, { role: "user", text: message, at: Date.now() }]);
    void run({
      kind: "chat",
      request: { tripId: brief.tripId, mode: "plan", brief, message },
    });
    return true;
  }
  /** One traveller message, recorded as an ordinary chat turn rather than a form
   *  submission. `override` lets a one-click example send its own text: React state
   *  has not flushed yet when the button fires, so reading `input` would send the
   *  previous value (usually empty, which the guard below then swallows). */
  function send(override?: string) {
    const message = (override ?? input).trim();
    // A picture can be the whole message: the turn goes out when there is text,
    // attachments, or both.
    if ((!message && attachments.length === 0) || active.current) return;
    // The files leave with this message: the transcript keeps their thumbnails,
    // the request carries their contents, and the composer is emptied. Holding
    // them past the send would attach them again to the next message.
    const files = attachments;
    const sent: Attachment[] = files.map(({ name, mediaType, kind, data }) => ({
      name,
      mediaType,
      kind,
      data,
    }));
    if (files.length) clearAttachments();
    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: message,
        at: Date.now(),
        ...(files.length ? { attachments: storedAttachments(files) } : {}),
      },
    ]);
    // No mode: the assistant reads the message and decides whether this is a question,
    // an edit, or a request to plan. The plan travels with the brief so a question can
    // be answered without rebuilding it.
    void run({
      kind: "chat",
      request: {
        ...(plan
          ? { tripId: plan.tripId, message, brief: plan.brief, plan }
          : { tripId: freshTripId.current, message, known: knownFromDraft(draft) }),
        ...(sent.length ? { attachments: sent } : {}),
      },
    });
  }
  /** Sends the question card's answers as the traveller's next message, carrying what the
   *  coordinator already understood (and the plan it asked about) so it carries on from there. */
  function answer(answers: QuestionAnswer[]) {
    if (!ask || active.current) return;
    const message = formatAskAnswers(ask.questions, answers);
    setMessages((current) => [...current, { role: "user", text: message, at: Date.now() }]);
    const current = ask.plan ?? plan;
    void run({
      kind: "chat",
      request: current
        ? { tripId: current.tripId, message, brief: current.brief, plan: current, known: ask.known }
        : {
            tripId: freshTripId.current,
            message,
            known: { ...knownFromDraft(draft), ...ask.known },
          },
    });
  }
  return { run, submit, send, answer };
}
