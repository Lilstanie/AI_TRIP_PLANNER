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
      ? t("mockDataBundledFixturesLive")
      : t("mockDataBundledFixturesSign");
  const unsignedSrMessage =
    liveBlock === "auth-not-configured"
      ? t("currentlyUsingMockFixturesLive")
      : t("currentlyUsingMockFixturesSign");
  const title = !liveAvailable
    ? unsignedMessage
    : live
      ? keyed
        ? t("liveDataRealHotelAnd")
        : t("liveDataSelectedButNo")
      : t("mockDataBundledFixturesNo");

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
      <span className="topbar-button__label">{t(live ? "liveData" : "mockData")}</span>
      {live && !keyed && (
        <span className="data-mode__warn" aria-hidden="true">
          !
        </span>
      )}
      <span className="sr-only">
        {!liveAvailable
          ? unsignedSrMessage
          : live
            ? t("currentlyUsingLiveProviderData")
            : t("currentlyUsingMockFixturesActivate")}
      </span>
    </button>
  );
}
