"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FlowChevronDownIcon } from "../ui/flow-icons";

export function Disclosure({
  icon,
  title,
  open,
  expandable,
  onToggle,
  collapsedContent,
  keepContentWhenOpen = false,
  state,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  open: boolean;
  expandable: boolean;
  onToggle: () => void;
  collapsedContent?: ReactNode;

  keepContentWhenOpen?: boolean;

  state?: "running" | "ok" | "error";
  className?: string;
  children?: ReactNode;
}) {
  const isOpen = expandable && open;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggle();
  };
  const leading = isOpen ? (
    <FlowChevronDownIcon className="thinking-row__chevron" />
  ) : expandable ? (
    <>
      <span className="thinking-row__idle">{icon}</span>
      <FlowChevronDownIcon className="thinking-row__chevron thinking-row__chevron-hover" />
    </>
  ) : (
    icon
  );

  return (
    <div
      className={cn("thinking-row", className)}
      data-open={isOpen || undefined}
      data-state={state}
    >
      <div
        className="thinking-row__line"
        data-expandable={expandable || undefined}
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? isOpen : undefined}
        onClick={expandable ? onToggle : undefined}
        onKeyDown={expandable ? onKeyDown : undefined}
      >
        <span className="thinking-row__leading" aria-hidden="true">
          {leading}
        </span>
        <span className="thinking-row__title">{title}</span>
        {(keepContentWhenOpen || !isOpen) && collapsedContent}
      </div>
      {isOpen && children}
    </div>
  );
}

export function RowSeparator() {
  return <span className="thinking-row__sep" aria-hidden="true" />;
}

export function RowSummary({
  text,
  followEnd = false,
  tone,
}: {
  text: string;
  followEnd?: boolean;
  tone?: "error";
}) {
  return (
    <span
      className="thinking-row__summary"
      data-follow-end={followEnd || undefined}
      data-tone={tone}
      title={text}
    >
      <span className="thinking-row__summary-text">{text}</span>
    </span>
  );
}
