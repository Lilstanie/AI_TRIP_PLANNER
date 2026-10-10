"use client";
import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";

const STEP_MS = 26;
const BUDGET_MS = 700;

const OPAQUE = new Set(["code", "pre"]);

type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
};
type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };

type HastParent = { children?: HastNode[] };

const isText = (node: HastNode): node is HastText => node.type === "text";
const isElement = (node: HastNode): node is HastElement => node.type === "element";
const isOpaque = (node: HastNode) => isElement(node) && OPAQUE.has(node.tagName);

const split = (value: string) => value.split(/(\s+)/).filter(Boolean);
const isSpace = (part: string) => /^\s+$/.test(part);

function countWords(node: HastParent): number {
  let total = 0;
  for (const child of node.children ?? []) {
    if (isText(child)) total += split(child.value).filter((part) => !isSpace(part)).length;
    else if (!isOpaque(child)) total += countWords(child as HastParent);
  }
  return total;
}

function wrap(node: HastParent, delayOf: () => number): void {
  const children = node.children;
  if (!children) return;
  const next: HastNode[] = [];
  let changed = false;
  for (const child of children) {
    if (isText(child)) {
      const parts = split(child.value);
      if (parts.every(isSpace)) {
        next.push(child);
        continue;
      }
      changed = true;
      for (const part of parts) {
        if (isSpace(part)) next.push({ type: "text", value: part });
        else
          next.push({
            type: "element",
            tagName: "span",
            properties: {
              className: ["msg-reveal__word"],
              style: `animation-delay:${delayOf()}ms`,
            },
            children: [{ type: "text", value: part }],
          });
      }
      continue;
    }
    if (!isOpaque(child)) wrap(child as HastParent, delayOf);
    next.push(child);
  }
  if (changed) node.children = next;
}

function rehypeWordReveal() {
  return (tree: HastParent) => {
    const total = countWords(tree);
    const step = total > 0 ? Math.min(STEP_MS, BUDGET_MS / total) : STEP_MS;
    let index = 0;
    wrap(tree, () => Math.round(index++ * step));
  };
}

export function RevealedText({
  text,
  components,

  animate = false,
}: {
  text: string;
  components?: Components;
  animate?: boolean;
}) {
  const [reveal] = useState(animate);
  const rehypePlugins = useMemo(() => (reveal ? [rehypeWordReveal] : []), [reveal]);
  return (
    <Markdown components={components} rehypePlugins={rehypePlugins}>
      {text}
    </Markdown>
  );
}
