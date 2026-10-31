"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Dialog } from "../ui/Dialog";
import { SettingsDialog } from "../account/SettingsDialog";
import type { WorkspaceModel } from "./useWorkspace";
import { useLocale } from "../account/LocaleProvider";

function RenameDialog({
  title,
  initial,
  onCancel,
  onSave,
}: {
  title: string;
  initial: string;
  onCancel(): void;
  onSave(name: string): void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const name = value.trim();
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.select());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <Dialog title={title} onClose={onCancel}>
      <form
        className="rename-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (name) onSave(name);
        }}
      >
        <input
          ref={input}
          aria-label={title}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="edit-discard__actions">
          <button type="button" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="submit" disabled={!name}>
            {t("save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function WorkspaceDialogs({ model }: { model: WorkspaceModel }) {
  const { t } = useLocale();
  const { dataMode } = model.session;
  const { dialog, closeDialog, settingsSection } = model.layout;
  const { catalogDialog, closeCatalogDialog, saveName, confirmDeleteChat } = model.history;

  return (
    <>
      {catalogDialog?.kind === "delete-chat" ? (
        <Dialog title={t("deleteChat")} onClose={closeCatalogDialog}>
          <p className="confirm-dialog">
            {t("deleteTitleTheLinkedTrip", { title: catalogDialog.title })}
          </p>
          <div className="edit-discard__actions">
            <button type="button" onClick={closeCatalogDialog}>
              {t("cancel")}
            </button>
            <button type="button" className="danger" onClick={confirmDeleteChat}>
              {t("delete")}
            </button>
          </div>
        </Dialog>
      ) : (
        catalogDialog && (
          <RenameDialog
            key={catalogDialog.id}
            title={t(catalogDialog.kind === "rename-chat" ? "renameChat" : "renameTrip")}
            initial={catalogDialog.title}
            onCancel={closeCatalogDialog}
            onSave={saveName}
          />
        )
      )}
      {dialog && (
        <Dialog title={t("settings")} onClose={closeDialog} page={!model.layout.narrow}>
          <SettingsDialog
            initial={settingsSection}
            onDataMode={dataMode.choose}
            onAccountModal={(open) => {
              flushSync(closeDialog);
              open();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
