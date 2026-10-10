"use client";
import { MapPinIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";

export function LocationPrompt({ onAllow, onDismiss }: { onAllow(): void; onDismiss(): void }) {
  const { t } = useLocale();
  return (
    <section className="location-prompt" aria-labelledby="location-prompt-title">
      <span className="location-prompt__icon" aria-hidden="true">
        <MapPinIcon />
      </span>
      <div className="location-prompt__text">
        <h2 id="location-prompt-title">{t("Show where you are on the map?")}</h2>
        <p>
          {t(
            "Your location is used only to show you on the map and for routes you ask for. It is not saved.",
          )}
        </p>
      </div>
      <div className="location-prompt__actions">
        <button type="button" className="primary" onClick={onAllow}>
          {t("Allow location")}
        </button>
        <button type="button" onClick={onDismiss}>
          {t("Not now")}
        </button>
      </div>
    </section>
  );
}
