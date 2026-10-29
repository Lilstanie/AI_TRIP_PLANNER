"use client";
import { resolveMentions } from "../chat/mentions";
import { useRef, type MutableRefObject } from "react";
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
import { formatAskAnswers, type PendingAsk, type QuestionAnswer } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import { storedAttachments } from "./useComposerAttachments";
import { briefErrors, datesLabel } from "@/lib/workspace/trip-facts";
import type { Notice } from "@/lib/i18n/notice";
import { translate } from "@/lib/i18n/locale";
import type { Message } from "@/lib/workspace";

type WorkspaceTransportOptions = {
  plan: TripPlan | undefined;

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
  finish(id: string, controller: AbortController, outcome: TurnOutcome, task: Task): void;

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

export function useWorkspaceTransport({
  plan,
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

  function confirmReplacingEditedPlan() {
    if (!plan) return true;
    const hasDirectEdits =
      (plan.editVersion ?? 0) > 0 &&
      (originalPlan.current === undefined || editSnapshot(plan) !== originalPlan.current);
    if (!hasDirectEdits) return true;
    const message = translate(
      interfaceLanguage,
      "Replace your edited plan? Your direct timeline edits will be replaced if the new plan succeeds.",
    );
    return window.confirm(message);
  }

  function run(
    task: Task,
    replacementConfirmed = false,
    change?: { message: Message; brief?: boolean; rewindIndex?: number },
  ): boolean {
    if (!canStart(task.request.tripId)) return false;
    if (!replacementConfirmed && !confirmReplacingEditedPlan()) return false;
    const controller = new AbortController();
    const id = start(task, controller, change);
    if (!id) return false;
    void (async () => {
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
            progress(id, controller, { kind: "progress", event });
          },
        },
      );

      finish(id, controller, outcome, task);
    })();
    return true;
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
      ? locale === "zh"
        ? `将预算调整为 ${amount}。`
        : `Change the budget to ${amount}.`
      : locale === "zh"
        ? `规划${brief.destination}行程，${dates}，${brief.groupSize} 位旅行人员，总预算 ${amount}。`
        : `Plan ${brief.destination}, ${dates}, for ${brief.groupSize} travellers with a total budget of ${amount}.`;
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

  function send(override?: string, rewindIndex?: number) {
    const message = (override ?? input).trim();

    if ((!message && attachments.length === 0) || !canStart(plan?.tripId ?? freshTripId.current))
      return false;
    if (!confirmReplacingEditedPlan()) return false;

    const files = attachments;
    const sent: Attachment[] = files.map(({ name, mediaType, kind, data }) => ({
      name,
      mediaType,
      kind,
      data,
    }));
    const mentions = resolveMentions(message, assistant?.names);
    const started = run(
      {
        kind: "chat",
        request: {
          ...(plan
            ? { tripId: plan.tripId, message, brief: plan.brief, plan }
            : { tripId: freshTripId.current, message, known: knownFromDraft(draft) }),
          ...(mentions.length ? { mentions } : {}),
          ...(destinationLocationFor(
            plan?.brief.destination ?? draft.destination,
            planDestinationLocation,
            draft.destinationLocation,
          )
            ? {
                destinationLocation: destinationLocationFor(
                  plan?.brief.destination ?? draft.destination,
                  planDestinationLocation,
                  draft.destinationLocation,
                ),
              }
            : {}),
          ...(sent.length ? { attachments: sent } : {}),
        },
      },
      true,
      {
        message: {
          role: "user",
          text: message,
          at: Date.now(),
          ...(files.length ? { attachments: storedAttachments(files) } : {}),
        },
        ...(rewindIndex === undefined ? {} : { rewindIndex }),
      },
    );
    if (started && files.length) clearAttachments();
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
  return { run, submit, send, answer };
}
