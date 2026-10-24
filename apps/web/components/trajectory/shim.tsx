"use client";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import Markdown from "react-markdown";
import css from "./shim.module.css";

interface IconProps {
  size?: number;
  className?: string;
}

function Icon({ size = 12, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconSearchOutlineRegular = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3 3" />
  </Icon>
);

export const IconChevronRightOutlineRegular = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </Icon>
);

export const IconSparkleRegular = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 1.5c.5 3.2 1.8 4.5 5 5-3.2.5-4.5 1.8-5 5-.5-3.2-1.8-4.5-5-5 3.2-.5 4.5-1.8 5-5Z" />
  </Icon>
);

export const IconUserOutlineRegular = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="5" r="2.75" />
    <path d="M2.5 14c.4-2.8 2.6-4.5 5.5-4.5s5.1 1.7 5.5 4.5" />
  </Icon>
);

export const IconChevronDownOutlineRegular = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3.5 6 4.5 4.5L12.5 6" />
  </Icon>
);

export type StateDotState = "done" | "warning" | "ongoing" | "error" | "idle";

export function StateDot({ state, size }: { state: StateDotState; size?: number | undefined }) {
  const edge = size ?? (state === "ongoing" ? 14 : 10);
  if (state === "ongoing") {
    return (
      <svg
        className={css.spinner}
        data-state="ongoing"
        width={edge}
        height={edge}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <g className={css.spinnerMotion}>
          <circle className={css.spinnerTrack} cx="12" cy="12" r="9.5" />
          <circle className={css.spinnerArc} cx="12" cy="12" r="9.5" />
        </g>
      </svg>
    );
  }
  return (
    <span
      className={css.dot}
      data-state={state}
      style={{ width: edge, height: edge }}
      aria-hidden="true"
    />
  );
}

export type TagTone = "outline" | "neutral" | "quiet" | "success" | "info" | "warning" | "danger";

export function Tag({
  tone = "outline",
  className,
  children,
}: {
  tone?: TagTone;
  className?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <span
      className={className === undefined ? css.tag : `${css.tag} ${className}`}
      data-tone={tone}
    >
      {children}
    </span>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string | (() => string);
  side?: "right" | "bottom" | "top";
  delayMs?: number;
  children: ReactElement<{ title?: string }>;
}) {
  return cloneElement(children, { title: typeof label === "function" ? label() : label });
}

export function JsonTree({ data, className }: { data: unknown; className?: string | undefined }) {
  return <pre className={className}>{JSON.stringify(data, null, 2)}</pre>;
}

export function MarkdownText({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        a: ({ href, children, ...rest }) => (
          <a {...rest} href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}

export function extractMarkdownPlainText(source: string): string {
  return source
    .replace(/```[^\n]*\n?/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "");
}
