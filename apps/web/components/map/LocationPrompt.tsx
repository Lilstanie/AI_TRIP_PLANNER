"use client";
import { MapPinIcon } from "../ui/icons";

/**
 * The in-app question asked when the workspace opens. It explains the use before the browser's own
 * permission prompt, which appears only after Allow location is pressed.
 */
export function LocationPrompt({ onAllow, onDismiss }: { onAllow(): void; onDismiss(): void }) {
  return (
    <section className="location-prompt" aria-labelledby="location-prompt-title">
      <span className="location-prompt__icon" aria-hidden="true">
        <MapPinIcon />
      </span>
      <div className="location-prompt__text">
        <h2 id="location-prompt-title">Show where you are on the map?</h2>
        <p>
          Your location is used only to show you on the map and for routes you ask for. It is not
          saved.
        </p>
      </div>
      <div className="location-prompt__actions">
        <button type="button" className="primary" onClick={onAllow}>
          Allow location
        </button>
        <button type="button" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
