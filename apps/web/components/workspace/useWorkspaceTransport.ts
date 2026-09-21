"use client";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { TripPlan, type AgentProgressEvent } from "@trip/shared";
import type { Decision } from "../trip/CheckpointCards";
import type { RouteResult } from "@/lib/integrations/google";
import {
  identifyActivities,
  draftFor,
  draftWithKnown,
  knownFromDraft,
  money,
  parseDraft,
  readPlanStream,
  NeedsInfoError,
  type Draft,
  type Message,
} from "@/lib/workspace";
import type { Task } from "./workspace-helpers";

type WorkspaceTransportOptions = {
  plan: TripPlan | undefined;
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
}: WorkspaceTransportOptions) {
  async function run(task: Task) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setRetry(undefined);
    if (task.kind === "chat")
      setActivity([
        { type: "coordinator", phase: "dispatch", round: 1, summary: "Preparing your request." },
      ]);
    try {
      let next: TripPlan;
      if (task.kind === "chat") {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(task.request),
          signal: controller.signal,
        });
        const result = await readPlanStream(response, (event) => {
          if (active.current === controller) setActivity((events) => [...events, event]);
        });
        next = result.plan;
        // A New chat or history switch replaced this request; its answer belongs nowhere.
        if (active.current !== controller) return;
        setMessages((current) => [...current, { role: "agent", text: result.reply }]);
        setInput("");
      } else {
        const response = await fetch("/api/hitl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan: task.plan, ...task.decision }),
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to apply this decision.");
        next = TripPlan.parse(body.plan);
        if (active.current !== controller) return;
      }
      const before = planRef.current;
      if (task.kind === "chat" || next.estTotal !== before?.estTotal)
        setPreviousTotal(before?.estTotal);
      setPlan(identifyActivities(next));
      if (task.kind === "chat") {
        setDraft(draftFor(next.brief));
        setSelectedActivity(undefined);
        setMapRoutes([]);
      }
      setErrors({});
      if (task.kind === "decision" && task.decision.action === "reject") onReject();
    } catch (failure) {
      if (active.current !== controller || controller.signal.aborted) return;
      // Not enough to plan yet: the assistant asks for the rest in the chat, and what it already
      // understood goes into the preferences form and travels with the next message.
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
  function send() {
    const message = input.trim();
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
  const onDecision = (decision: Decision) => {
    if (plan) void run({ kind: "decision", plan, decision });
  };
  return { run, submit, send, onDecision };
}
