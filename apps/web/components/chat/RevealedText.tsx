"use client";
import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";

/**
 * Word-by-word reveal for the newest agent reply, in the spirit of the
 * streaming-text components on shadcn/ui and Magic UI's `TextAnimate`
 * (`blurIn`): each word fades up from a small blur a beat after the one before
 * it. Those components drive the stagger from a motion library; this one does
 * it with a plain CSS animation and a per-word `animation-delay`, so the reply
 * keeps its Markdown rendering and the app keeps its dependency list.
 *
 * The split happens on the *rendered* tree, not on the raw string: a rehype
 * plugin walks the HTML react-markdown produced and replaces each text node
 * with one `<span class="msg-reveal__word">` per word, leaving the whitespace
 * between them as plain text. Headings, lists, links and emphasis therefore
 * survive untouched, and the complete text is in the DOM from the first frame
 * -- only `opacity` and `filter` animate -- so a screen reader, a find-in-page
 * and a copy/paste all see the whole reply immediately.
 */

/** Per-word stagger, and the ceiling on the whole reveal, in milliseconds. */
const STEP_MS = 26;
const BUDGET_MS = 700;

/** Text inside these keeps its exact character run; splitting it would add
 *  inline-block boxes to code the reader expects to be monospaced and pre. */
const OPAQUE = new Set(["code", "pre"]);

/** The slice of hast this plugin needs. Typed locally rather than imported
 *  from `hast`, which is a transitive dependency of react-markdown. */
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

/** Words in a text run; whitespace-only runs carry none. */
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

/** Splits every rendered text node into delayed word spans. The stagger shrinks
 *  on a long reply so the last word still lands inside the budget. */
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
  /** True only for a reply that arrived in this session; latched on mount so a
   *  re-render, or a later prop change, never replays the reveal. */
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
