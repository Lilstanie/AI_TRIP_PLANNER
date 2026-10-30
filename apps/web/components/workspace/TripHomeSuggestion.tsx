"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";
import { scheduledCount } from "@/lib/trip/day-actions";
import { tripIdeas } from "@/lib/trip/ideas";
import { dayCount } from "@/lib/trip/timeline";
import { translate, type AppLocale } from "@/lib/i18n/locale";

export const TRIP_SUGGESTION_DISMISSALS_KEY = "trip-home-suggestion-dismissals-v1";

export function tripSuggestion(
  plan: TripPlan,
  locale: AppLocale,
): { text: string; prompt: string; action: string } {
  const t = (text: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, text, params);
  const ideas = tripIdeas(plan).length;
  if (ideas === 1)
    return {
      text: t("1 unscheduled idea in {destination}", { destination: plan.brief.destination }),
      prompt: t(
        "Review the 1 unscheduled idea in my current {destination} plan and suggest where it fits.",
        { destination: plan.brief.destination },
      ),
      action: t("Place it"),
    };
  if (ideas)
    return {
      text: t("{count} unscheduled ideas in {destination}", {
        count: ideas,
        destination: plan.brief.destination,
      }),
      prompt: t(
        "Review the {count} unscheduled ideas in my current {destination} plan and suggest where they fit.",
        { count: ideas, destination: plan.brief.destination },
      ),
      action: t("Place them"),
    };
  const days = dayCount(plan);
  if (!scheduledCount(plan))
    return {
      text: t("Your {destination} days are still empty", { destination: plan.brief.destination }),
      prompt: t("Plan the {days} days of my {destination} trip.", {
        days,
        destination: plan.brief.destination,
      }),
      action: t("Plan the days"),
    };
  return {
    text: t("Your {days}-day {destination} plan is ready", {
      days,
      destination: plan.brief.destination,
    }),
    prompt: t(
      "Suggest one improvement for my current {days}-day {destination} plan, taking the existing itinerary into account.",
      { days, destination: plan.brief.destination },
    ),
    action: t("Get a suggestion"),
  };
}

export function TripHomeSuggestion({
  tripId,
  plan,
  onChoose,
}: {
  tripId: string;
  plan: TripPlan;
  onChoose(prompt: string): void;
}) {
  const { t, locale } = useLocale();
  const suggestion = tripSuggestion(plan, locale);
  const planKey = JSON.stringify(plan);
  const [dismissed, setDismissed] = useState(false);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const dismissals = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem(TRIP_SUGGESTION_DISMISSALS_KEY) ?? "{}",
      );
      dismissals.current =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? Object.fromEntries(
              Object.entries(parsed).filter((entry): entry is [string, string] => {
                return typeof entry[1] === "string";
              }),
            )
          : {};
    } catch {
      dismissals.current = {};
    }
    setDismissed(dismissals.current[tripId] === planKey);
    setPersistenceFailed(false);
    setReady(true);
  }, [planKey, tripId]);

  if (!ready) return null;
  const dismiss = () => {
    dismissals.current[tripId] = planKey;
    try {
      localStorage.setItem(TRIP_SUGGESTION_DISMISSALS_KEY, JSON.stringify(dismissals.current));
    } catch {
      setPersistenceFailed(true);
    }
    setDismissed(true);
  };
  return (
    <>
      {!dismissed && (
        <section className="trip-home-suggestion" aria-label={t("Trip suggestion")}>
          <p>{suggestion.text}</p>
          <button
            type="button"
            className="trip-home-suggestion__action"
            onClick={() => onChoose(suggestion.prompt)}
          >
            {suggestion.action}
          </button>
          <button
            type="button"
            className="trip-home-suggestion__dismiss"
            aria-label={t("Dismiss")}
            onClick={dismiss}
          >
            <CloseIcon />
          </button>
        </section>
      )}
      {persistenceFailed && (
        <p className="muted trip-home-suggestion__status" role="status">
          {t("Dismissed for this visit; could not save.")}
        </p>
      )}
    </>
  );
}
