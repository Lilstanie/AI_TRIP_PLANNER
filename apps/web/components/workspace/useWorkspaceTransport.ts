"use client";
import type { MutableRefObject } from "react";
import {
  TripPlan,
  type AssistantSettings,
  type Attachment,
  type Currency,
  type InterfaceLanguage,
} from "@trip/shared";
import { plannerAud } from "@/lib/money";
import { knownFromDraft, parseDraft, type Draft } from "@/lib/workspace";
import { requestTurn, type SessionEvent, type Task } from "@/lib/workspace/session";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import { formatAskAnswers, type PendingAsk, type QuestionAnswer } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import { storedAttachments } from "./useComposerAttachments";
import { briefErrors } from "@/lib/workspace/trip-facts";
import type { Notice } from "@/lib/i18n/notice";

type WorkspaceTransportOptions = {
  plan: TripPlan | undefined;
  /** Fixtures or real providers; travels with each planning request. */
  dataMode: DataMode | undefined;
  draft: Draft;
  input: string;
  freshTripId: MutableRefObject<string>;
  active: MutableRefObject<AbortController | null>;
  /** Applies a turn's start, progress and outcome to the session (see `session()`). */
  dispatch(event: SessionEvent): void;
  /** Files the composer is holding for the next message. */
  attachments: PreparedAttachment[];
  /** Drops the held files once they have left with a message. */
  clearAttachments(): void;
  /** The structured question awaiting an answer, if the coordinator asked one. */
  ask: PendingAsk | undefined;
  /** A submission was rejected; `fields` holds one message per invalid field. */
  onReject(fields: Record<string, Notice>): void;
  /** Settings → Personalization: reply style and whether chat memory is on. */
  assistant?: AssistantSettings;
  /**
   * The interface language. The assistant replies in the language of the message itself and falls
   * back to this one only when the message does not show a language.
   */
  interfaceLanguage: InterfaceLanguage;
  /**
   * The Settings display currency, sent with every request so the server writes in the currency
   * the panels show for a trip that named none. The server never writes it back.
   */
  displayCurrency: Currency;
};

/**
 * Sends planning turns. It only sends the request and reads the stream; how each outcome changes
 * the workspace is decided by `session()`.
 */
export function useWorkspaceTransport({
  plan,
  draft,
  input,
  freshTripId,
  active,
  dispatch,
  attachments,
  clearAttachments,
  ask,
  onReject,
  dataMode,
  assistant,
  interfaceLanguage,
  displayCurrency,
}: WorkspaceTransportOptions) {
  async function run(task: Task) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    dispatch({ kind: "started" });
    const outcome = await requestTurn(
      task,
      (signal) =>
        fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", ...dataModeHeaders(dataMode) },
          body: JSON.stringify({
            ...task.request,
            ...(assistant ? { assistant } : {}),
            interfaceLanguage,
            displayCurrency,
          }),
          signal,
        }),
      {
        signal: controller.signal,
        onProgress: (event) => {
          if (active.current === controller) dispatch({ kind: "progress", event });
        },
      },
    );
    // A New chat or history switch replaced this request; its outcome belongs nowhere.
    if (active.current !== controller) return;
    active.current = null;
    dispatch(outcome);
  }
  /** Plans with the whole brief. `next` is a chip's edit that React state has not flushed yet.
   *  Returns false when nothing was sent: a request is running, or the brief was rejected. */
  function submit(next: Draft = draft): boolean {
    if (active.current) return false;
    const parsed = parseDraft(next, plan?.brief ?? { tripId: freshTripId.current });
    if (!parsed.success) {
      const fields = briefErrors(parsed.error.issues);
      dispatch({ kind: "rejected", fields });
      onReject(fields);
      return false;
    }
    const brief = parsed.data;
    const message = `Plan ${brief.destination}, ${brief.dates.join(" to ")}, ${brief.groupSize} travellers, ${plannerAud(brief.budgetTotal)} total, with the submitted accommodation preferences.`;
    dispatch({
      kind: "sent",
      message: { role: "user", text: message, at: Date.now() },
      brief: true,
    });
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
    dispatch({
      kind: "sent",
      message: {
        role: "user",
        text: message,
        at: Date.now(),
        ...(files.length ? { attachments: storedAttachments(files) } : {}),
      },
    });
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
    dispatch({ kind: "sent", message: { role: "user", text: message, at: Date.now() } });
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
