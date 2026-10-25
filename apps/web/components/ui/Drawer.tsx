"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

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
  embedded = false,
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

  hideTitle?: boolean;
  embedded?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  const wasEmbedded = useRef(embedded);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const becameModal = wasEmbedded.current && !embedded;
    wasEmbedded.current = embedded;
    if (embedded) {
      wasOpen.current = open;
      return;
    }
    if (open && (!wasOpen.current || becameModal))
      closeButton.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current && panel.current?.contains(document.activeElement))
      returnFocus.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [embedded, open, returnFocus]);

  useEffect(() => {
    if (!open || embedded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onCloseRef.current();
      returnFocus.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded, open, returnFocus]);

  return (
    <section
      ref={panel}
      className={`drawer drawer--${side}${open ? " is-open" : ""} ${className}`.trim()}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : open}
      aria-labelledby={embedded ? undefined : titleId}
      aria-hidden={embedded ? undefined : !open}
      inert={!embedded && !open}
      onKeyDown={
        embedded
          ? undefined
          : (event) => {
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
            }
      }
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
