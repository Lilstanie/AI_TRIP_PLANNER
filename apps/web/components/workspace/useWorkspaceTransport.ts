"use client";
import { resolveMentions } from "../chat/mentions";
import { useEffect, useRef, type MutableRefObject } from "react";
import {
  TripPlan,
  type AssistantSettings,
  type Attachment,
  type Currency,
  type InterfaceLanguage,
} from "@trip/shared";
import { moneyDisplay } from "@/lib/money";
import { destinationLocationFor, knownFromDraft, parseDraft, type Draft } from "@/lib/workspace";
import {
  requestTurn,
  type SessionEvent,
  type Task,
  type TurnOutcome,
} from "@/lib/workspace/session";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import { CHAT_RUN_HEADER } from "@/lib/chat/run-header";
import {
  forgetPendingRun,
  pageLeaving,
  pendingRun,
  rememberPendingRun,
} from "@/lib/workspace/pending-runs";
import { formatAskAnswers, type PendingAsk, type QuestionAnswer } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import { storedAttachments } from "./useComposerAttachments";
import { briefErrors, datesLabel } from "@/lib/workspace/trip-facts";
import type { Notice } from "@/lib/i18n/notice";
import { translate } from "@/lib/i18n/locale";
import type { Message } from "@/lib/workspace";

type WorkspaceTransportOptions = {
  plan: TripPlan | undefined;
  /** The conversation open on load; its pending run is resumed once after mount. */
  activeConversation: MutableRefObject<string>;
  hasTurn(conversationId: string): boolean;
  shownMessages(): Message[];

  dataMode: DataMode | undefined;
  draft: Draft;
  input: string;
  freshTripId: MutableRefObject<string>;
  canStart(tripId: string): boolean;
  start(
    task: Task,
    controller: AbortController,
    change?: { message: Message; brief?: boolean; rewindIndex?: number },
  ): string | undefined;
  progress(id: string, controller: AbortController, event: SessionEvent): void;
  /** `keepPending` leaves the server run resumable because only the connection was lost. */
  finish(
    id: string,
    controller: AbortController,
    outcome: TurnOutcome,
    task: Task,
    keepPending?: boolean,
  ): void;

  dispatch(event: SessionEvent): void;

  attachments: PreparedAttachment[];

  clearAttachments(): void;

  ask: PendingAsk | undefined;

  onReject(fields: Record<string, Notice>): void;

  assistant?: AssistantSettings;

  interfaceLanguage: InterfaceLanguage;

  displayCurrency: Currency;
  planDestinationLocation?: Draft["destinationLocation"];
};

type ChatSendContext = {
  plan: TripPlan;
  draft: Draft;
  attachments?: PreparedAttachment[];
  planDestinationLocation?: Draft["destinationLocation"];
};

export function useWorkspaceTransport({
  plan,
  activeConversation,
  hasTurn,
  shownMessages,
  draft,
  input,
  freshTripId,
  canStart,
  start,
  progress,
  finish,
  dispatch,
  attachments,
  clearAttachments,
  ask,
  onReject,
  dataMode,
  assistant,
  interfaceLanguage,
  displayCurrency,
  planDestinationLocation,
}: WorkspaceTransportOptions) {
  const originalPlan = useRef<string | undefined>(undefined);
  const editSnapshot = (value: TripPlan) =>
    JSON.stringify({
      tripId: value.tripId,
      brief: value.brief,
      dayNotes: value.dayNotes,
      sections: value.sections.map((section) => ({
        id: section.id,
        proposal: section.proposal
          ? {
              items: section.proposal.items,
              stays: section.proposal.stays,
              flights: section.proposal.flights,
            }
          : undefined,
      })),
    });
  if (plan && (plan.editVersion ?? 0) === 0) originalPlan.current = editSnapshot(plan);

  function confirmReplacingEditedPlan(currentPlan = plan) {
    if (!currentPlan) return true;
    const hasDirectEdits =
      (currentPlan.editVersion ?? 0) > 0 &&
      (originalPlan.current === undefined || editSnapshot(currentPlan) !== originalPlan.current);
    if (!hasDirectEdits) return true;
    const message = translate(interfaceLanguage, "replaceYourEditedPlanYour");
    return window.confirm(message);
  }

  function run(
    task: Task,
    replacementConfirmed = false,
    change?: { message: Message; brief?: boolean; rewindIndex?: number },
    resumeRunId?: string,
  ): boolean {
    if (!canStart(task.request.tripId)) return false;
    if (!replacementConfirmed && !confirmReplacingEditedPlan()) return false;
    const controller = new AbortController();
    const id = start(task, controller, change);
    if (!id) return false;
    const runId = resumeRunId ?? crypto.randomUUID();
    if (!resumeRunId)
      rememberPendingRun(id, { runId, task, message: change?.message, startedAt: Date.now() });
    let interrupted = false;
    const tracked = async (response: Promise<Response>) => {
      const sent = await response.catch((error: unknown) => {
        interrupted = true;
        throw error;
      });
      if (!sent.body) return sent;
      const reader = sent.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(stream) {
          try {
            const { done, value } = await reader.read();
            if (done) stream.close();
            else stream.enqueue(value);
          } catch (error) {
            interrupted = true;
            stream.error(error);
          }
        },
        cancel: (reason) => reader.cancel(reason),
      });
      return new Response(body, { status: sent.status, headers: sent.headers });
    };
    void (async () => {
      const outcome = await requestTurn(
        task,
        (signal) =>
          tracked(
            resumeRunId
              ? fetch(`/api/chat?run=${runId}`, { signal, cache: "no-store" })
              : fetch("/api/chat", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    [CHAT_RUN_HEADER]: runId,
                    ...dataModeHeaders(dataMode),
                  },
                  body: JSON.stringify({
                    ...task.request,
                    ...(assistant ? { assistant } : {}),
                    interfaceLanguage,
                    displayCurrency,
                  }),
                  signal,
                }),
          ),
        {
          signal: controller.signal,
          onProgress: (event) => {
            progress(id, controller, { kind: "progress", event });
          },
        },
      );
      if (pageLeaving()) return;
      const lostConnection =
        outcome.kind === "failed" &&
        (interrupted ||
          ("key" in outcome.message && outcome.message.key === "connectionEndedBeforeThePlan"));
      finish(id, controller, outcome, task, lostConnection);
    })();
    return true;
  }

  function resumePending(conversationId: string) {
    if (hasTurn(conversationId)) return;
    const pending = pendingRun(conversationId);
    if (!pending) return;
    const shown = shownMessages();
    const answered = shown.some(
      (item) => item.role === "agent" && (item.at ?? 0) >= pending.startedAt,
    );
    const missing =
      pending.message !== undefined &&
      !shown.some((item) => item.role === "user" && item.at === pending.message?.at);
    const resumed =
      !answered &&
      run(
        pending.task,
        true,
        missing && pending.message ? { message: pending.message } : undefined,
        pending.runId,
      );
    if (!resumed) forgetPendingRun(conversationId);
  }

  function submit(next: Draft = draft): boolean {
    if (!canStart(plan?.tripId ?? freshTripId.current)) return false;
    const parsed = parseDraft(next, plan?.brief ?? { tripId: freshTripId.current });
    if (!parsed.success) {
      const fields = briefErrors(parsed.error.issues);
      dispatch({ kind: "rejected", fields });
      onReject(fields);
      return false;
    }
    if (!confirmReplacingEditedPlan()) return false;
    const brief = parsed.data;
    const previous = plan?.brief;
    const unchangedTripFields: (keyof typeof brief)[] = [
      "origin",
      "destination",
      "dates",
      "groupSize",
      "party",
      "preferences",
    ];
    const onlyBudgetChanged =
      previous !== undefined &&
      unchangedTripFields.every(
        (field) => JSON.stringify(previous[field]) === JSON.stringify(brief[field]),
      ) &&
      previous.budgetTotal !== brief.budgetTotal;
    const locale = interfaceLanguage;
    const amount = moneyDisplay({ currency: displayCurrency, locale }).money(
      brief.budgetTotal,
      brief.budgetSource,
    );
    const dates = datesLabel(brief.dates[0], brief.dates[1], locale)?.range ?? "";
    const message = onlyBudgetChanged
      ? translate(locale, "changeTheBudgetTo", { amount })
      : translate(locale, "planDestinationDatesTravellersBudget", {
          destination: brief.destination,
          dates,
          count: brief.groupSize,
          amount,
        });
    return run(
      {
        kind: "chat",
        request: {
          tripId: brief.tripId,
          mode: "plan",
          brief,
          message,
          ...(destinationLocationFor(next.destination, next.destinationLocation)
            ? {
                destinationLocation: destinationLocationFor(
                  next.destination,
                  next.destinationLocation,
                ),
              }
            : {}),
        },
      },
      true,
      {
        message: { role: "user", text: message, at: Date.now() },
        brief: true,
      },
    );
  }

  function prepareChat(override?: string, context?: ChatSendContext) {
    const currentPlan = context?.plan ?? plan;
    const currentDraft = context?.draft ?? draft;
    const message = (override ?? (context ? "" : input)).trim();
    const files = context ? (context.attachments ?? []) : attachments;
    if (
      (!message && files.length === 0) ||
      !canStart(currentPlan?.tripId ?? freshTripId.current) ||
      !confirmReplacingEditedPlan(currentPlan)
    )
      return;
    const sent: Attachment[] = files.map(({ name, mediaType, kind, data }) => ({
      name,
      mediaType,
      kind,
      data,
    }));
    const mentions = resolveMentions(message, assistant?.names);
    const destination = currentPlan?.brief.destination ?? currentDraft.destination;
    const location = destinationLocationFor(
      destination,
      context?.planDestinationLocation ??
        (currentPlan?.tripId === plan?.tripId ? planDestinationLocation : undefined),
      currentDraft.destinationLocation,
    );
    return {
      task: {
        kind: "chat" as const,
        request: {
          ...(currentPlan
            ? {
                tripId: currentPlan.tripId,
                message,
                brief: currentPlan.brief,
                plan: currentPlan,
              }
            : { tripId: freshTripId.current, message, known: knownFromDraft(currentDraft) }),
          ...(mentions.length ? { mentions } : {}),
          ...(location ? { destinationLocation: location } : {}),
          ...(sent.length ? { attachments: sent } : {}),
        },
      },
      change: {
        message: {
          role: "user" as const,
          text: message,
          at: Date.now(),
          ...(files.length ? { attachments: storedAttachments(files) } : {}),
        },
      },
      usesAttachments: files.length > 0,
    };
  }

  function send(override?: string, rewindIndex?: number, context?: ChatSendContext) {
    const prepared = prepareChat(override, context);
    if (!prepared) return false;
    const started = run(prepared.task, true, {
      ...prepared.change,
      ...(rewindIndex === undefined ? {} : { rewindIndex }),
    });
    if (started && prepared.usesAttachments) clearAttachments();
    return started;
  }

  function answer(answers: QuestionAnswer[]) {
    if (!ask || !canStart((ask.plan ?? plan)?.tripId ?? freshTripId.current)) return;
    if (!confirmReplacingEditedPlan()) return;
    const message = formatAskAnswers(ask.questions, answers);
    const current = ask.plan ?? plan;
    const known = current ? undefined : { ...knownFromDraft(draft), ...ask.known };
    const destination = current?.brief.destination ?? known?.destination;
    const location = destinationLocationFor(
      destination ?? "",
      planDestinationLocation,
      draft.destinationLocation,
    );
    run(
      {
        kind: "chat",
        request: {
          ...(current
            ? {
                tripId: current.tripId,
                message,
                brief: current.brief,
                plan: current,
                known: ask.known,
              }
            : {
                tripId: freshTripId.current,
                message,
                known,
              }),
          ...(location ? { destinationLocation: location } : {}),
        },
      },
      true,
      { message: { role: "user", text: message, at: Date.now() } },
    );
  }
  const resumeOnLoad = useRef(resumePending);
  resumeOnLoad.current = resumePending;
  useEffect(() => {
    resumeOnLoad.current(activeConversation.current);
  }, [activeConversation]);
  return { run, resumePending, submit, prepareChat, send, answer };
}
