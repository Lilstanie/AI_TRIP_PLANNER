"use client";
import { useLocale } from "@/components/account/LocaleProvider";
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

const GUTTER = 12;

export type CloseReason = "dismiss" | "outside";

export function FactPopover({
  id,
  title,
  description,
  anchor,
  onClose,
  className = "",
  modal = false,
  leaving = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  anchor: RefObject<HTMLElement | null>;
  onClose(reason: CloseReason): void;
  className?: string;

  modal?: boolean;

  leaving?: boolean;
  children: ReactNode;
}) {
  const { t } = useLocale();
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
    if (leaving) return;

    const first =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ??
      panel.current?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
    (first ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus({
      preventScroll: true,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leaving) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onCloseRef.current("dismiss");
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;

      onCloseRef.current(modal ? "dismiss" : "outside");
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, modal, leaving]);

  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <>
      <div
        className={`fact-popover-scrim${modal ? " fact-popover-scrim--modal" : ""}`}
        data-leaving={leaving || undefined}
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
        data-leaving={leaving || undefined}
        aria-hidden={leaving || undefined}
        inert={leaving}
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
            aria-label={t("Close {v0}", { v0: title.toLowerCase() })}
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
