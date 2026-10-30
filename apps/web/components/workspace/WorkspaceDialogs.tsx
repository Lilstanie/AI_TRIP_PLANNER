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
            {t("Cancel")}
          </button>
          <button type="submit" disabled={!name}>
            {t("Save")}
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
        <Dialog title={t("Delete chat")} onClose={closeCatalogDialog}>
          <p className="confirm-dialog">
            {t("Delete “{title}”? The linked trip will be kept.", { title: catalogDialog.title })}
          </p>
          <div className="edit-discard__actions">
            <button type="button" onClick={closeCatalogDialog}>
              {t("Cancel")}
            </button>
            <button type="button" className="danger" onClick={confirmDeleteChat}>
              {t("Delete")}
            </button>
          </div>
        </Dialog>
      ) : (
        catalogDialog && (
          <RenameDialog
            key={catalogDialog.id}
            title={t(catalogDialog.kind === "rename-chat" ? "Rename chat" : "Rename trip")}
            initial={catalogDialog.title}
            onCancel={closeCatalogDialog}
            onSave={saveName}
          />
        )
      )}
      {dialog && (
        <Dialog title={t("Settings")} onClose={closeDialog} page={!model.layout.narrow}>
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
