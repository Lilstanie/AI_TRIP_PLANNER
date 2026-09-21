"use client";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { TripPlan, type AgentProgressEvent } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import {
  identifyActivities,
  draftFor,
  draftWithKnown,
  knownFromDraft,
  money,
  parseDraft,
  readPlanStream,
  FlightAnswerError,
  NeedsInfoError,
  type Draft,
  type Message,
} from "@/lib/workspace";
import type { Task } from "./workspace-helpers";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";

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
  onReject(): void;
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
    setActivity([
      { type: "coordinator", phase: "dispatch", round: 1, summary: "Preparing your request." },
    ]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...dataModeHeaders(dataMode) },
        body: JSON.stringify(task.request),
        signal: controller.signal,
      });
      const result = await readPlanStream(response, (event) => {
        if (active.current === controller) setActivity((events) => [...events, event]);
      });
      const next = result.plan;
      // A New chat or history switch replaced this request; its answer belongs nowhere.
      if (active.current !== controller) return;
      setMessages((current) => [...current, { role: "agent", text: result.reply }]);
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
          { role: "agent", text: failure.answer.reply, flights: failure.answer },
        ]);
        setInput("");
        setActivity([]);
        return;
      }
      // Not enough to plan yet: the assistant asks for the rest in its own words
      // in the chat, and what it already understood goes into the preferences
      // form and travels with the next message.
      if (failure instanceof NeedsInfoError) {
        setMessages((current) => [...current, { role: "agent", text: failure.needsInfo.question }]);
        setDraft((current) => draftWithKnown(current, failure.needsInfo.known));
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
  function submit() {
    if (active.current) return;
    const parsed = parseDraft(draft, plan?.brief ?? { tripId: freshTripId.current });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      setError("Check the highlighted trip preferences.");
      onReject();
      return;
    }
    setErrors({});
    const brief = parsed.data;
    const message = `Plan ${brief.destination}, ${brief.dates.join(" to ")}, ${brief.groupSize} travellers, ${money(brief.budgetTotal)} total, with the submitted accommodation preferences.`;
    setMessages((current) => [...current, { role: "user", text: message }]);
    void run({
      kind: "chat",
      request: { tripId: brief.tripId, mode: "plan", brief, message },
    });
  }
  /** One traveller message, recorded as an ordinary chat turn rather than a form
   *  submission. `override` lets a one-click example send its own text: React state
   *  has not flushed yet when the button fires, so reading `input` would send the
   *  previous value (usually empty, which the guard below then swallows). */
  function send(override?: string) {
    const message = (override ?? input).trim();
    if (!message || active.current) return;
    setMessages((current) => [...current, { role: "user", text: message }]);
    // No mode: the assistant reads the message and decides whether this is a question,
    // an edit, or a request to plan. The plan travels with the brief so a question can
    // be answered without rebuilding it.
    void run({
      kind: "chat",
      request: plan
        ? { tripId: plan.tripId, message, brief: plan.brief, plan }
        : { tripId: freshTripId.current, message, known: knownFromDraft(draft) },
    });
  }
  return { run, submit, send };
}
