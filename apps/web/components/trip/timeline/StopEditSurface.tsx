"use client";
import { useId, useRef, type ReactNode } from "react";
import { FactPopover } from "../../preferences/FactPopover";

export function StopEditSurface({
  title,
  complex = false,
  onClose,
  children,
}: {
  title: string;
  complex?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement>(null);
  return (
    <FactPopover
      id={`stop-edit-${id}`}
      title={title}
      anchor={anchor}
      onClose={onClose}
      modal
      className={`fact-popover--stop${complex ? " fact-popover--complex" : ""}`}
    >
      {children}
    </FactPopover>
  );
}
