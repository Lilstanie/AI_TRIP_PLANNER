"use client";
import { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { EditInput } from "@/lib/trip/trip-edit";
import { failureNotice, NoticeError, type Notice } from "@/lib/i18n/notice";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";

export type PreviewAnswer = {
  blockers: Notice[];

  routes: RouteResult[];

  plan?: TripPlan;
};

export async function requestPreview({
  plan,
  operation,
  displayCurrency,
  dataMode,
  signal,
  failure = { key: "Preview failed. Try the change again." },
}: {
  plan: TripPlan;
  operation: EditInput["operation"];
  displayCurrency?: string;
  dataMode: DataMode | undefined;
  signal: AbortSignal;

  failure?: Notice;
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
  if (!response.ok) throw new NoticeError(failureNotice(body, failure));
  const blockers: Notice[] = body.blockerNotices ?? [];
  const routes: RouteResult[] = body.routes ?? [];
  if (blockers.length) return { blockers, routes };
  return { blockers, routes, plan: TripPlan.parse(body.plan) };
}
