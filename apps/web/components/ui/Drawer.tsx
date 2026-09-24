"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * An overlay drawer that slides in from one side of the workspace.
 *
 * Closed drawers are translated completely outside the workspace, hidden from assistive
 * technology and inert, so they leave no rail, handle or reserved width behind. While open,
 * focus moves into the drawer, Tab stays inside it, and closing returns focus to the trigger.
 */
export function Drawer({
  side,
  open,
  title,
  closeLabel,
  onClose,
  returnFocus,
  className = "",
  meta,
  hideTitle = false,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  title: string;
  closeLabel: string;
  onClose(): void;
  returnFocus: RefObject<HTMLElement | null>;
  className?: string;
  meta?: ReactNode;
  /**
   * Keeps the title as the dialog's accessible name but draws no title row; the close button then
   * floats over the drawer's top edge. For drawers whose content already opens with its own header.
   */
  hideTitle?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open && !wasOpen.current) closeButton.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current && panel.current?.contains(document.activeElement))
      returnFocus.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open, returnFocus]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Nested controls (an edit preview, a native dialog) handle their own Escape first.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onCloseRef.current();
      returnFocus.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, returnFocus]);

  return (
    <section
      ref={panel}
      className={`drawer drawer--${side}${open ? " is-open" : ""} ${className}`.trim()}
      role="dialog"
      aria-modal={open}
      aria-labelledby={titleId}
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || !panel.current) return;
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (item) => item.offsetParent !== null || item === document.activeElement,
        );
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <header className={`drawer__head${hideTitle ? " drawer__head--bare" : ""}`}>
        <div className={hideTitle ? "sr-only" : "drawer__title"}>
          <h2 id={titleId}>{title}</h2>
          {meta}
        </div>
        <button
          ref={closeButton}
          type="button"
          className="drawer__close"
          aria-label={closeLabel}
          onClick={() => {
            onClose();
            returnFocus.current?.focus({ preventScroll: true });
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="drawer__body">{children}</div>
    </section>
  );
}
