"use client";
import { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { EditInput } from "@/lib/trip/trip-edit";
import { failureNotice, NoticeError, type Notice } from "@/lib/i18n/notice";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";

/** The server's answer to one edit: refused when `blockers` is not empty, accepted otherwise. */
export type PreviewAnswer = {
  blockers: Notice[];
  /** The routes the answer verified, for the map and the timeline's legs. */
  routes: RouteResult[];
  /** The accepted plan; absent when the edit was refused. */
  plan?: TripPlan;
};

/**
 * Sends one edit to `POST /api/trip/preview-edit`, which recomputes routes, budget and conflicts. The
 * request names the data mode, so a simulated plan's legs are fixtures. Throws a NoticeError when the
 * request itself fails; a refusal is an answer with blockers.
 */
export async function requestPreview({
  plan,
  operation,
  displayCurrency,
  dataMode,
  signal,
}: {
  plan: TripPlan;
  operation: EditInput["operation"];
  displayCurrency?: string;
  dataMode: DataMode | undefined;
  signal: AbortSignal;
}): Promise<PreviewAnswer> {
  const response = await fetch("/api/trip/preview-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...dataModeHeaders(dataMode) },
    body: JSON.stringify({
      plan,
      baseVersion: plan.editVersion ?? 0,
      operation,
      displayCurrency,
    }),
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new NoticeError(failureNotice(body, { key: "Preview failed. Try the change again." }));
  const blockers: Notice[] = body.blockerNotices ?? [];
  const routes: RouteResult[] = body.routes ?? [];
  if (blockers.length) return { blockers, routes };
  return { blockers, routes, plan: TripPlan.parse(body.plan) };
}
