"use client";
import { factLabels } from "@/lib/workspace/trip-facts";
import { useLocale } from "../account/LocaleProvider";
import type { WorkspaceController } from "./useWorkspaceController";

/** "Sydney · 1 Oct – 4 Oct" from what the traveller stated, or "New trip" before anything is. */
export function usePhoneTripTitle(model: Pick<WorkspaceController, "draft" | "plan">) {
  const { locale, currency, t } = useLocale();
  const labels = factLabels(model.draft, model.plan?.brief, { locale, currency });
  const range = labels.when?.split(" · ")[0];
  return [labels.where, range].filter(Boolean).join(" · ") || t("New trip");
}

/** The phone top bar's single line: the trip title. */
export function PhoneTripTitle({ model }: { model: WorkspaceController }) {
  const title = usePhoneTripTitle(model);
  return <h1 className="topbar-title phone-topbar__title">{title}</h1>;
}
