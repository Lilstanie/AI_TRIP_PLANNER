"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useEffect, useRef, type ReactNode } from "react";
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
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={onClose}>
      <div className="dialog__head">
        <h2 id="dialog-title">{title}</h2>
        <button onClick={onClose} aria-label={t("Close {v0}", { v0: title })}>
          {t("Close")}
        </button>
      </div>
      {children}
    </dialog>
  );
}
