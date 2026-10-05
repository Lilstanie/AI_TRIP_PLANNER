"use client";
import type { ReactNode } from "react";
import { GearIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";
import { DataModeToggle } from "./DataModeToggle";
import { LanguageToggle } from "./LanguageToggle";
import type { WorkspaceController } from "./useWorkspaceController";

/**
 * The phone shell's Mine tab: everything the navigation drawer held. `chats` is the Chats panel
 * content (search, New chat, New trip, trips and chats), built by the workspace view.
 */
export function PhoneMine({ model, chats }: { model: WorkspaceController; chats: ReactNode }) {
  const { t } = useLocale();
  const { dataMode, busy, openSettings } = model;
  return (
    <div className="phone-mine">
      {chats}
      <div
        className="phone-mine__controls"
        role="group"
        aria-label={t("Data and language controls")}
      >
        <DataModeToggle
          mode={dataMode.mode}
          providers={dataMode.providers}
          onChange={dataMode.choose}
          disabled={busy}
        />
        <LanguageToggle />
      </div>
      <button type="button" className="phone-mine__settings" onClick={() => openSettings()}>
        <GearIcon />
        <span>{t("Settings")}</span>
      </button>
    </div>
  );
}
