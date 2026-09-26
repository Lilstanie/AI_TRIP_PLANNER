"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreIcon } from "./icons";

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect(): void;
  disabled?: boolean;
  /** "danger" for destructive actions such as Remove. */
  tone?: "danger";
  /** Draw a divider before this item, grouping the menu like Mindtrip's. */
  separated?: boolean;
};

/**
 * A "…" button that opens a menu of actions. Arrow keys move between items, Escape closes it and
 * returns focus to the trigger (in the capture phase, so an enclosing drawer stays open), and a
 * click outside or tabbing away closes it.
 */
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const focusItem = (step: 1 | -1 | "first" | "last") => {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      step === "first"
        ? 0
        : step === "last"
          ? buttons.length - 1
          : (current + step + buttons.length) % buttons.length;
    buttons[index]?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    focusItem("first");
    const close = (restore: boolean) => {
      setOpen(false);
      if (restore) trigger.current?.focus({ preventScroll: true });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusItem(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusItem(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusItem("first");
      } else if (event.key === "End") {
        event.preventDefault();
        focusItem("last");
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) close(false);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!wrap.current?.contains(event.relatedTarget as Node | null)) close(false);
    };
    const element = wrap.current;
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    element?.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
      element?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  return (
    <div className="action-menu" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="action-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div ref={menu} className="action-menu__list" role="menu" aria-label={label}>
          {items.map((item) => (
            <div key={item.label} role="none">
              {item.separated && <hr className="action-menu__separator" aria-hidden="true" />}
              <button
                type="button"
                role="menuitem"
                className={item.tone === "danger" ? "is-danger" : undefined}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon && <span className="action-menu__icon" aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
