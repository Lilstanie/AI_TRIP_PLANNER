"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { CloseIcon } from "@/components/ui/icons";
import { buildItinerary } from "@/lib/trip/itinerary";
import { dayCount } from "@/lib/trip/timeline";

export const TRIP_SUGGESTION_DISMISSALS_KEY = "trip-home-suggestion-dismissals-v1";

export function tripSuggestion(plan: TripPlan): { text: string; prompt: string } {
  const { t } = useLocale();
  const ideas = buildItinerary(plan, () => undefined).ideas().length;
  if (ideas)
    return {
      text: t("{count} unscheduled ideas in {destination}. Want help placing them?", {
        count: ideas,
        destination: plan.brief.destination,
      }),
      prompt: t(
        "Review the {count} unscheduled ideas in my current {destination} plan and suggest where they fit.",
        { count: ideas, destination: plan.brief.destination },
      ),
    };
  const days = dayCount(plan);
  return {
    text: t("Your {days}-day {destination} plan is ready. Want a fresh suggestion?", {
      days,
      destination: plan.brief.destination,
    }),
    prompt: t(
      "Suggest one improvement for my current {days}-day {destination} plan, taking the existing itinerary into account.",
      { days, destination: plan.brief.destination },
    ),
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
  const { t } = useLocale();
  const suggestion = tripSuggestion(plan);
  const planKey = JSON.stringify(plan);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  const dismissals = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      dismissals.current = JSON.parse(
        localStorage.getItem(TRIP_SUGGESTION_DISMISSALS_KEY) ?? "{}",
      ) as Record<string, string>;
    } catch {
      dismissals.current = {};
    }
    setDismissed(dismissals.current[tripId] === planKey);
    setReady(true);
  }, [planKey, tripId]);

  if (!ready || dismissed) return null;
  const dismiss = () => {
    dismissals.current[tripId] = planKey;
    localStorage.setItem(TRIP_SUGGESTION_DISMISSALS_KEY, JSON.stringify(dismissals.current));
    setDismissed(true);
  };
  return (
    <section className="trip-home-suggestion" aria-label={t("Trip suggestion")}>
      <p>{suggestion.text}</p>
      <div className="trip-home-suggestion__actions">
        <button type="button" onClick={() => onChoose(suggestion.prompt)}>
          {t("Ask AI")}
        </button>
        <button
          type="button"
          className="trip-home-suggestion__dismiss"
          aria-label={t("Dismiss")}
          onClick={dismiss}
        >
          <CloseIcon />
          <span>{t("Dismiss")}</span>
        </button>
      </div>
    </section>
  );
}
