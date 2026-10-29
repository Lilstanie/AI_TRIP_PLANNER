"use client";
import { useLocale } from "../account/LocaleProvider";

export function TripDrawerEmpty({
  phone,
  onPlanInChat,
  onAddDetails,
}: {
  phone: boolean;
  onPlanInChat(): void;
  onAddDetails(): void;
}) {
  const { t } = useLocale();
  return (
    <div className="trip-drawer-empty">
      <p>
        {phone
          ? t("No trip yet. Plan one in Chat and your itinerary and budget will appear here.")
          : t(
              "No trip yet. Describe where you want to go in the chat, or add your trip details. Your itinerary and budget will appear here.",
            )}
      </p>
      <button type="button" onClick={phone ? onPlanInChat : onAddDetails}>
        {phone ? t("Plan in Chat") : t("Add trip details")}
      </button>
    </div>
  );
}
