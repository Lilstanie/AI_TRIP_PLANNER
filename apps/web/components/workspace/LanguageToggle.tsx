"use client";

import { useSettings } from "../account/SettingsProvider";
import { GlobeIcon } from "../ui/icons";

/** A one-press language switch for the workspace's highest-frequency setting. */
export function LanguageToggle() {
  const { settings, update } = useSettings();
  const chinese = settings.language === "zh-CN";
  const label = chinese ? "切换至 English" : "Switch language to 简体中文";

  return (
    <button
      type="button"
      className="topbar-button language-toggle"
      aria-label={label}
      title={label}
      onClick={() => update({ language: chinese ? "en" : "zh-CN" })}
    >
      <GlobeIcon />
      <span className="topbar-button__label" aria-hidden="true">
        {chinese ? "中文" : "EN"}
      </span>
    </button>
  );
}
