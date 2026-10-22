"use client";
import { resolveMentions } from "../chat/mentions";
import type { MutableRefObject } from "react";
import {
  TripPlan,
  type AssistantSettings,
  type Attachment,
  type Currency,
  type InterfaceLanguage,
} from "@trip/shared";
import { moneyDisplay } from "@/lib/money";
import { destinationLocationFor, knownFromDraft, parseDraft, type Draft } from "@/lib/workspace";
import { requestTurn, type SessionEvent, type Task } from "@/lib/workspace/session";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import { formatAskAnswers, type PendingAsk, type QuestionAnswer } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import { storedAttachments } from "./useComposerAttachments";
import { briefErrors, datesLabel } from "@/lib/workspace/trip-facts";
import type { Notice } from "@/lib/i18n/notice";

type WorkspaceTransportOptions = {
  plan: TripPlan | undefined;

  dataMode: DataMode | undefined;
  draft: Draft;
  input: string;
  freshTripId: MutableRefObject<string>;
  active: MutableRefObject<AbortController | null>;

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
  planDestinationLocation,
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

    if (active.current !== controller) return;
    active.current = null;
    dispatch(outcome);
  }

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
    dispatch({
      kind: "sent",
      message: { role: "user", text: message, at: Date.now() },
      brief: true,
    });
    void run({
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
    });
    return true;
  }

  function send(override?: string) {
    const message = (override ?? input).trim();

    if ((!message && attachments.length === 0) || active.current) return;

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

    const mentions = resolveMentions(message);
    void run({
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
    });
  }

  function answer(answers: QuestionAnswer[]) {
    if (!ask || active.current) return;
    const message = formatAskAnswers(ask.questions, answers);
    dispatch({ kind: "sent", message: { role: "user", text: message, at: Date.now() } });
    const current = ask.plan ?? plan;
    const known = current ? undefined : { ...knownFromDraft(draft), ...ask.known };
    const destination = current?.brief.destination ?? known?.destination;
    const location = destinationLocationFor(
      destination ?? "",
      planDestinationLocation,
      draft.destinationLocation,
    );
    void run({
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
    });
  }
  return { run, submit, send, answer };
}
