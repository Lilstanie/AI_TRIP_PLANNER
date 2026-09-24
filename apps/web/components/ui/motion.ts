"use client";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/**
 * Motion helpers shared by the workspace. None of them adds a dependency: they lean on CSS
 * transitions, the View Transitions API and a delayed unmount. Each one does nothing where the
 * platform cannot animate (jsdom, older browsers) or the reader asked for reduced motion, so the
 * interface behaves exactly as it would without them.
 */
export function motionAllowed() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Runs a state change that swaps a whole region (a page, a chat, the phone Chat/Map view) inside a
 * view transition, so the old and new views cross-fade instead of cutting. `kind` is written to
 * `<html data-transition>` for the duration so CSS can pick the animation.
 */
export function viewTransition(update: () => void, kind = "swap") {
  const doc = typeof document === "undefined" ? undefined : (document as ViewTransitionDocument);
  if (!doc?.startViewTransition || !motionAllowed()) {
    update();
    return;
  }
  const root = doc.documentElement;
  root.dataset.transition = kind;
  const transition = doc.startViewTransition(() => flushSync(update));
  void transition.finished.finally(() => {
    if (root.dataset.transition === kind) delete root.dataset.transition;
  });
}

/**
 * Keeps a conditionally rendered layer mounted for `ms` after `value` goes away, so it can play an
 * exit animation. `leaving` is true during that time; the layer should be inert and hidden from
 * assistive technology while it is. Without motion the layer unmounts at once.
 */
export function usePresence<T>(value: T | undefined, ms: number) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (value !== undefined) {
      setShown(value);
      return;
    }
    if (!motionAllowed()) {
      setShown(undefined);
      return;
    }
    const timer = window.setTimeout(() => setShown(undefined), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  // The new value renders in the same pass it arrives, not one effect later.
  return { value: value ?? shown, leaving: value === undefined && shown !== undefined };
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Drives the sliding thumb of a segmented control (a tab list or a pressed-button group). It
 * measures the selected child and writes `--segment-x` and `--segment-w` on the container, which
 * the stylesheet uses to place a `::before` thumb that glides between segments. `data-segmented`
 * turns the thumb on only once it has a position, so it never flies in from the corner.
 */
export function useSegmentIndicator(container: RefObject<HTMLElement | null>, selected: unknown) {
  const measured = useRef(false);
  useIsoLayoutEffect(() => {
    const track = container.current;
    if (!track) return;
    const place = () => {
      const item = track.querySelector<HTMLElement>(
        ':scope > [aria-selected="true"], :scope > [aria-pressed="true"]',
      );
      if (!item) {
        delete track.dataset.segmented;
        return;
      }
      track.style.setProperty("--segment-x", `${item.offsetLeft}px`);
      track.style.setProperty("--segment-w", `${item.offsetWidth}px`);
      track.dataset.segmented = measured.current ? "ready" : "placed";
      if (!measured.current) {
        measured.current = true;
        requestAnimationFrame(() => {
          if (track.dataset.segmented) track.dataset.segmented = "ready";
        });
      }
    };
    place();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : undefined;
    observer?.observe(track);
    return () => observer?.disconnect();
  }, [container, selected]);
}
