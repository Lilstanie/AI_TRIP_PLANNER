"use client";
import type { DataMode, DataModeProviders, LiveBlock } from "@/lib/workspace/data-mode";
import { useLocale } from "../account/LocaleProvider";

export function DataModeToggle({
  mode,
  providers,
  onChange,
  disabled,
  liveAvailable = true,
  liveBlock,
}: {
  mode: DataMode | undefined;
  providers: DataModeProviders | undefined;
  onChange: (mode: DataMode) => void;
  disabled?: boolean;
  liveAvailable?: boolean;
  liveBlock?: LiveBlock;
}) {
  const { t } = useLocale();

  if (!mode) return null;

  const live = mode === "live";
  const keyed = providers?.hotelsAndFlights ?? true;
  const unsignedMessage =
    liveBlock === "auth-not-configured"
      ? t("Mock data: bundled fixtures. Live provider data is off on this deployment.")
      : t("Mock data: bundled fixtures. Sign in to plan with live hotel and flight prices.");
  const unsignedSrMessage =
    liveBlock === "auth-not-configured"
      ? t(". Currently using mock fixtures. Live provider data is off on this deployment.")
      : t(". Currently using mock fixtures. Sign in to plan with live hotel and flight prices.");
  const title = !liveAvailable
    ? unsignedMessage
    : live
      ? keyed
        ? t(
            "Live data: real hotel and flight prices. Each plan spends the shared monthly search allowance.",
          )
        : t(
            "Live data selected, but no SERPAPI_KEY is configured, so results fall back to estimates.",
          )
      : t("Mock data: bundled fixtures. No provider requests and no allowance spent.");

  return (
    <button
      type="button"
      className={`topbar-button data-mode data-mode--${live ? "live" : "mock"}`}
      aria-pressed={live}
      aria-disabled={!liveAvailable || undefined}
      disabled={disabled}
      title={title}
      onClick={() => liveAvailable && onChange(live ? "mock" : "live")}
    >
      <span className="data-mode__dot" aria-hidden="true" />
      <span className="topbar-button__label">{t(live ? "Live data" : "Mock data")}</span>
      {live && !keyed && (
        <span className="data-mode__warn" aria-hidden="true">
          !
        </span>
      )}
      <span className="sr-only">
        {!liveAvailable
          ? unsignedSrMessage
          : live
            ? t(". Currently using live provider data. Activate to switch to mock fixtures.")
            : t(". Currently using mock fixtures. Activate to switch to live provider data.")}
      </span>
    </button>
  );
}
