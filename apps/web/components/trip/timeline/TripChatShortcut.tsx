"use client";
import { useLocale } from "@/components/account/LocaleProvider";

export function TripChatShortcut({
  day,
  stop,
  onSend,
}: {
  day: number;
  stop?: string;
  onSend(message: string): void;
}) {
  const { t } = useLocale();
  const label = stop ? t("Ask AI about {v0}", { v0: stop }) : t("Ask AI about this day");
  const message = stop
    ? t("Suggest a change for {v0} on Day {v1}, taking the rest of my current plan into account.", {
        v0: stop,
        v1: day,
      })
    : t("Suggest improvements for Day {v0}, taking the rest of my current plan into account.", {
        v0: day,
      });
  return (
    <button type="button" onClick={() => onSend(message)} aria-label={label}>
      {label}
    </button>
  );
}
