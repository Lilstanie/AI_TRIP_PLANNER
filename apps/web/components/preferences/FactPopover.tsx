"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { CloseIcon } from "../ui/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Space kept between the popover and the viewport edge, and below its chip. */
const GUTTER = 12;

export type CloseReason = "dismiss" | "outside";

/**
 * A small editor anchored under the top-bar chip that opened it, or, with `modal`, a dialog centred
 * over a scrim (Where and Trip preferences, which hold lists, as Mindtrip's do). On phones the
 * stylesheet turns either into a bottom sheet over a scrim.
 *
 * It is a labelled dialog: focus moves to its first field, Tab stays inside it, and Escape closes
 * it — unless a native dialog opened from inside it (the calendar) is on top, which closes first.
 * A click outside discards the edit without pulling focus back to the chip, because the click has
 * already put the traveller somewhere else.
 */
export function FactPopover({
  id,
  title,
  description,
  anchor,
  onClose,
  className = "",
  modal = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  anchor: RefObject<HTMLElement | null>;
  onClose(reason: CloseReason): void;
  className?: string;
  /** Centred over a scrim instead of anchored to the chip. */
  modal?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [position, setPosition] = useState<{ top: number; left: number }>();

  useLayoutEffect(() => {
    if (modal) return;
    const place = () => {
      const chip = anchor.current?.getBoundingClientRect();
      const width = panel.current?.offsetWidth ?? 0;
      if (!chip) return;
      const max = Math.max(GUTTER, window.innerWidth - width - GUTTER);
      setPosition({ top: chip.bottom + 8, left: Math.min(Math.max(GUTTER, chip.left), max) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, modal]);

  useEffect(() => {
    // An editor can name the control to start on; otherwise its first field.
    const first =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ??
      panel.current?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
    (first ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus({
      preventScroll: true,
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // The calendar is a native modal dialog; the browser closes it first.
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onCloseRef.current("dismiss");
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // The chip toggles itself, so a press on it is not "outside".
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      // A press on a modal's scrim lands nowhere else, so focus goes back to the chip.
      onCloseRef.current(modal ? "dismiss" : "outside");
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, modal]);

  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <>
      <div
        className={`fact-popover-scrim${modal ? " fact-popover-scrim--modal" : ""}`}
        aria-hidden="true"
      />
      <section
        ref={panel}
        id={id}
        role="dialog"
        aria-modal={modal || undefined}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`fact-popover ${modal ? "fact-popover--modal " : ""}${className}`.trim()}
        data-placed={position ? "true" : undefined}
        style={
          position && !modal
            ? ({
                "--fact-popover-top": `${position.top}px`,
                "--fact-popover-left": `${position.left}px`,
              } as CSSProperties)
            : undefined
        }
        onKeyDown={(event) => {
          if (event.key !== "Tab" || !panel.current) return;
          const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (item) =>
              !item.closest("dialog") &&
              (item.offsetParent !== null || item === document.activeElement),
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
        <header className="fact-popover__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descriptionId} className="fact-popover__description">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="fact-popover__close"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={() => onClose("dismiss")}
          >
            <CloseIcon />
          </button>
        </header>
        {children}
      </section>
    </>
  );
}
