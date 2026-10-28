"use client";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

export function StopPopover({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string;
  anchor?: RefObject<HTMLElement | null>;
  onClose(): void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    box.current?.scrollIntoView?.({ block: "nearest" });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target) || anchor?.current?.contains(target)) return;
      close.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [anchor]);
  return (
    <div
      ref={box}
      role="dialog"
      aria-label={title}
      className="stop-popover"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }}
    >
      {children}
    </div>
  );
}
