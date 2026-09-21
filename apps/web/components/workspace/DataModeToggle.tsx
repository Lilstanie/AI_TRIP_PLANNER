"use client";
import type { DataMode, DataModeProviders } from "@/lib/workspace/data-mode";

/**
 * Switches the planner between bundled fixtures and the real providers.
 *
 * Live mode spends a shared monthly SerpApi allowance, so the button states
 * which mode is active rather than hiding it behind a settings panel, and says
 * up front when live mode has no key to work with.
 */
export function DataModeToggle({
  mode,
  providers,
  onChange,
  disabled,
}: {
  mode: DataMode | undefined;
  providers: DataModeProviders | undefined;
  onChange: (mode: DataMode) => void;
  disabled?: boolean;
}) {
  // Until the server reports its default, showing "Mock" would be a guess that
  // visibly flips a moment later.
  if (!mode) return null;

  const live = mode === "live";
  const keyed = providers?.hotelsAndFlights ?? true;
  const title = live
    ? keyed
      ? "Live data: real hotel and flight prices. Each plan spends the shared monthly search allowance."
      : "Live data selected, but no SERPAPI_KEY is configured, so results fall back to estimates."
    : "Mock data: bundled fixtures. No provider requests and no allowance spent.";

  return (
    <button
      type="button"
      className={`topbar-button data-mode data-mode--${live ? "live" : "mock"}`}
      aria-pressed={live}
      disabled={disabled}
      title={title}
      onClick={() => onChange(live ? "mock" : "live")}
    >
      <span className="data-mode__dot" aria-hidden="true" />
      <span className="topbar-button__label">{live ? "Live data" : "Mock data"}</span>
      {live && !keyed && <span className="data-mode__warn" aria-hidden="true">!</span>}
      <span className="sr-only">
        {live
          ? ". Currently using live provider data. Activate to switch to mock fixtures."
          : ". Currently using mock fixtures. Activate to switch to live provider data."}
      </span>
    </button>
  );
}
