"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={onClose}>
      <div className="dialog__head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="dialog__close"
          onClick={onClose}
          aria-label={t("Close {v0}", { v0: title })}
        >
          <CloseIcon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
