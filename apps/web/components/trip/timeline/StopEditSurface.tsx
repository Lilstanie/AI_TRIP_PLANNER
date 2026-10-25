"use client";
import { useId, useRef, type ReactNode } from "react";
import { FactPopover } from "../../preferences/FactPopover";

export function StopEditSurface({
  title,
  complex = false,
  phone = false,
  onClose,
  children,
}: {
  title: string;
  complex?: boolean;
  phone?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement>(null);
  if (!phone) return children;
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
