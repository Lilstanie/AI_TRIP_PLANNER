"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HTMLAttributes, PointerEvent } from "react";
import {
  END_OF_DAY,
  insertionIndex,
  parseZone,
  zoneKey,
  type DragSource,
  type DropTarget,
  type DropZone,
} from "@/lib/trip/drag-target";

const MOUSE_THRESHOLD = 5;
const TOUCH_SLOP = 10;
const LONG_PRESS_MS = 400;
const ZONE_REACH = 12;
const CLICK_GUARD_MS = 400;
const EDGE = 56;
const MAX_SCROLL = 18;

function scrollParent(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight)
      return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}
const IGNORED =
  "input, textarea, select, a, form, label, [contenteditable], [role='menu'], [role='menuitem'], [role='dialog']";

type Session = {
  pointerId: number;
  source: DragSource;
  element: HTMLElement;
  touch: boolean;
  x: number;
  y: number;
  active: boolean;
  timer: number | undefined;
};

export type RowDrag = HTMLAttributes<HTMLLIElement> & {
  "data-drop-row": string;
  "data-dragging"?: "true";
};

function showsZone(zone: HTMLElement, x: number, y: number): boolean {
  return document.elementsFromPoint(x, y).some((element) => zone.contains(element));
}

function targetAt(
  source: DragSource,
  x: number,
  y: number,
  accepts: (source: DragSource, zone: DropZone) => boolean,
): DropTarget | null {
  for (const element of document.querySelectorAll<HTMLElement>("[data-drop-zone]")) {
    const zone = parseZone(element.dataset.dropZone);
    if (!zone || !accepts(source, zone)) continue;
    const bounds = element.getBoundingClientRect();
    if (element.dataset.dropEnd !== undefined) {
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
      if (!showsZone(element, x, y)) continue;
      return { zone, index: END_OF_DAY };
    }
    if (x < bounds.left || x > bounds.right) continue;
    if (y < bounds.top - ZONE_REACH || y > bounds.bottom + ZONE_REACH) continue;
    if (!showsZone(element, x, Math.min(Math.max(y, bounds.top), bounds.bottom - 1))) continue;
    const middles = [...element.querySelectorAll<HTMLElement>(":scope > [data-drop-row]")]
      .filter((row) => row.dataset.dropRow !== source.id)
      .map((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
    return { zone, index: insertionIndex(middles, y) };
  }
  return null;
}

export function useItineraryDrag({
  locked,
  accepts,
  onDrop,
}: {
  locked: boolean;
  accepts(source: DragSource, zone: DropZone): boolean;
  onDrop(source: DragSource, target: DropTarget): void;
}) {
  const [dragging, setDragging] = useState("");
  const [target, setTarget] = useState<DropTarget | null>(null);
  const session = useRef<Session | null>(null);
  const stop = useRef<() => void>(() => undefined);
  const latest = useRef({ locked, accepts, onDrop });
  useEffect(() => {
    latest.current = { locked, accepts, onDrop };
  });

  const end = useCallback((commit: boolean) => {
    const current = session.current;
    stop.current();
    if (!current) return;
    session.current = null;
    window.clearTimeout(current.timer);
    current.element.style.transform = "";
    document.documentElement.classList.remove("is-reordering");
    const found = current.active
      ? targetAt(current.source, current.x, current.y, latest.current.accepts)
      : null;
    setDragging("");
    setTarget(null);
    if (current.active) {
      const swallow = (event: Event) => {
        if (!current.element.contains(event.target as Node)) return;
        event.stopPropagation();
        window.removeEventListener("click", swallow, true);
      };
      window.addEventListener("click", swallow, true);
      window.setTimeout(() => window.removeEventListener("click", swallow, true), CLICK_GUARD_MS);
    }
    if (commit && found && !latest.current.locked) latest.current.onDrop(current.source, found);
  }, []);

  useEffect(() => {
    if (locked) end(false);
  }, [locked, end]);
  useEffect(() => () => end(false), [end]);

  const begin = (event: PointerEvent<HTMLLIElement>, source: DragSource) => {
    if (latest.current.locked || !event.isPrimary || event.button !== 0) return;
    if ((event.target as Element).closest(IGNORED)) return;
    end(false);
    const touch = event.pointerType !== "mouse";
    const current: Session = {
      pointerId: event.pointerId,
      source,
      element: event.currentTarget,
      touch,
      x: event.clientX,
      y: event.clientY,
      active: false,
      timer: undefined,
    };
    session.current = current;
    const originX = event.clientX;
    const originY = event.clientY;
    const scroller = scrollParent(event.currentTarget);
    const scrollStart = scroller.scrollTop;
    let frame = 0;

    const refresh = () => {
      current.element.style.transform = `translate3d(0, ${
        current.y - originY + scroller.scrollTop - scrollStart
      }px, 0)`;
      const found = targetAt(source, current.x, current.y, latest.current.accepts);
      setTarget((previous) =>
        previous &&
        found &&
        previous.index === found.index &&
        zoneKey(previous.zone) === zoneKey(found.zone)
          ? previous
          : found,
      );
    };
    const autoScroll = () => {
      frame = 0;
      if (!current.active) return;
      const root = scroller === document.scrollingElement || scroller === document.documentElement;
      const bounds = root
        ? { top: 0, bottom: window.innerHeight }
        : scroller.getBoundingClientRect();
      const toTop = current.y - (bounds.top + EDGE);
      const toBottom = current.y - (bounds.bottom - EDGE);
      const step =
        toTop < 0
          ? -Math.min(MAX_SCROLL, (-toTop / EDGE) * MAX_SCROLL)
          : toBottom > 0
            ? Math.min(MAX_SCROLL, (toBottom / EDGE) * MAX_SCROLL)
            : 0;
      if (!step) return;
      const before = scroller.scrollTop;
      scroller.scrollTop += step;
      if (scroller.scrollTop === before) return;
      refresh();
      frame = window.requestAnimationFrame(autoScroll);
    };

    const activate = () => {
      window.getSelection()?.removeAllRanges();
      current.active = true;
      document.documentElement.classList.add("is-reordering");
      setDragging(source.id);
      setTarget(targetAt(source, current.x, current.y, latest.current.accepts));
    };
    if (touch) current.timer = window.setTimeout(activate, LONG_PRESS_MS);

    let handled: Event | undefined;
    const once =
      <T extends Event>(handler: (event: T) => void) =>
      (next: T) => {
        if (handled === next) return;
        handled = next;
        handler(next);
      };
    const move = once((next: globalThis.PointerEvent) => {
      if (next.pointerId !== current.pointerId) return;
      current.x = next.clientX;
      current.y = next.clientY;
      const travel = Math.hypot(next.clientX - originX, next.clientY - originY);
      if (!current.active) {
        if (!touch && travel >= MOUSE_THRESHOLD) activate();
        else if (touch && travel > TOUCH_SLOP) end(false);
        if (!current.active) return;
      }
      refresh();
      if (!frame) frame = window.requestAnimationFrame(autoScroll);
    });
    const up = once((next: globalThis.PointerEvent) => {
      if (next.pointerId === current.pointerId) end(true);
    });
    const cancel = once((next: globalThis.PointerEvent) => {
      if (next.pointerId === current.pointerId) end(false);
    });
    const key = (next: KeyboardEvent) => {
      if (next.key === "Escape" && current.active) {
        next.stopPropagation();
        end(false);
      }
    };
    const hold = (next: Event) => {
      if (current.active && next.cancelable) next.preventDefault();
    };
    const suppress = (next: Event) => {
      if (touch || current.active) next.preventDefault();
    };
    const listen = (target: EventTarget) => {
      target.addEventListener("pointermove", move as EventListener);
      target.addEventListener("pointerup", up as EventListener);
      target.addEventListener("pointercancel", cancel as EventListener);
    };
    const unlisten = (target: EventTarget) => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up as EventListener);
      target.removeEventListener("pointercancel", cancel as EventListener);
    };
    listen(window);
    listen(current.element);
    window.addEventListener("keydown", key, true);
    window.addEventListener("touchmove", hold, { passive: false });
    current.element.addEventListener("touchmove", hold, { passive: false });
    window.addEventListener("contextmenu", suppress);
    stop.current = () => {
      window.cancelAnimationFrame(frame);
      unlisten(window);
      unlisten(current.element);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("touchmove", hold);
      current.element.removeEventListener("touchmove", hold);
      window.removeEventListener("contextmenu", suppress);
      stop.current = () => undefined;
    };
  };

  const rowProps = (source: DragSource): RowDrag => ({
    "data-drop-row": source.id,
    ...(dragging === source.id ? { "data-dragging": "true" as const } : {}),
    onPointerDown: (event) => begin(event, source),
  });

  return { dragging, target, rowProps };
}
