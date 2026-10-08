"use client";
import { flushSync } from "react-dom";
import { Dialog } from "../ui/Dialog";
import { SettingsDialog } from "../account/SettingsDialog";
import type { WorkspaceModel } from "./useWorkspace";
import { useLocale } from "../account/LocaleProvider";

export function WorkspaceDialogs({ model }: { model: WorkspaceModel }) {
  const { t } = useLocale();
  const { dataMode } = model.session;
  const { dialog, closeDialog, settingsSection } = model.layout;

  return (
    <>
      {dialog && (
        <Dialog title={t("Settings")} onClose={closeDialog}>
          <SettingsDialog
            initial={settingsSection}
            onDataMode={dataMode.choose}
            onAccountModal={(open) => {
              // Close the native dialog's top layer before Clerk mounts its DOM portal.
              flushSync(closeDialog);
              open();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
