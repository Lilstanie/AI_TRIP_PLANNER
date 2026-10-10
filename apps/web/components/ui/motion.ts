"use client";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

export function motionAllowed() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
    ready?: Promise<void>;
    updateCallbackDone?: Promise<void>;
  };
};

export function viewTransition(update: () => void, kind = "swap") {
  const doc = typeof document === "undefined" ? undefined : (document as ViewTransitionDocument);
  if (!doc?.startViewTransition || !motionAllowed()) {
    update();
    return;
  }
  const root = doc.documentElement;
  root.dataset.transition = kind;
  const transition = doc.startViewTransition(() => flushSync(update));
  const cleanup = () => {
    if (root.dataset.transition === kind) delete root.dataset.transition;
  };

  void transition.finished.then(cleanup, cleanup);
  void transition.ready?.catch(() => undefined);
  void transition.updateCallbackDone?.catch(() => undefined);
}

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

  return { value: value ?? shown, leaving: value === undefined && shown !== undefined };
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
