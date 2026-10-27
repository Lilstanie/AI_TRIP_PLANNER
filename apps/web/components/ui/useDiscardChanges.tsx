"use client";
import { useRef, useState } from "react";
import { useLocale } from "../account/LocaleProvider";
import { Dialog } from "./Dialog";

export function useDiscardChanges(dirty: boolean) {
  const { t } = useLocale();
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<() => void>(() => {});
  const requestClose = (close: () => void) => {
    if (!dirty) {
      close();
      return;
    }
    pending.current = close;
    setConfirming(true);
  };
  const confirmation = confirming ? (
    <Dialog title={t("Discard changes?")} onClose={() => setConfirming(false)}>
      <div className="edit-discard__actions">
        <button type="button" autoFocus onClick={() => setConfirming(false)}>
          {t("Continue editing")}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            setConfirming(false);
            requestAnimationFrame(() => pending.current());
          }}
        >
          {t("Discard changes")}
        </button>
      </div>
    </Dialog>
  ) : null;
  return { requestClose, confirmation };
}
