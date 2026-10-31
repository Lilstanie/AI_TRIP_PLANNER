"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
export function Dialog({
  title,
  onClose,
  children,
  page = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  page?: boolean;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    if (page) dialog.show();
    else dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, [page]);
  useEffect(() => {
    if (!page) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.("dialog, [role='dialog'], .cl-rootBox")) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose, page]);
  return (
    <dialog
      ref={ref}
      className={`dialog${page ? " dialog--page" : ""}`}
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <div className="dialog__head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="dialog__close"
          onClick={onClose}
          aria-label={t("closeV0", { v0: title })}
        >
          <CloseIcon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
