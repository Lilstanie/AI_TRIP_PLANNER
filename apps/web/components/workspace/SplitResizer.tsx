"use client";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { CHAT_SHARE, clampChatShare } from "@/lib/workspace/catalog";

const STEP = 0.02;
/** Pointer travel that counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3;

/**
 * The draggable divider between chat and map on desktop. It reads its position from
 * `--chat-share` on the workspace shell and, while dragging, writes that variable straight onto
 * the shell so nothing re-renders per pointer move; the trip drawer reads the same variable, so it
 * always covers exactly the map. Arrow keys, Home and End move it; double-click resets it.
 */
export function SplitResizer({
  share,
  onChange,
}: {
  share?: number;
  onChange(share: number | undefined): void;
}) {
  const drag = useRef<{
    shell: HTMLElement;
    left: number;
    width: number;
    share: number;
    startX: number;
    moved: boolean;
  }>(null);

  const current = (handle: HTMLElement) => {
    const shell = handle.parentElement;
    const chat = shell?.querySelector(".workspace-panel--chat");
    const width = shell?.getBoundingClientRect().width ?? 0;
    return (
      share ?? (width ? (chat?.getBoundingClientRect().width ?? 0) / width : CHAT_SHARE.default)
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const shell = event.currentTarget.parentElement;
    if (!shell) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const box = shell.getBoundingClientRect();
    shell.dataset.resizing = "true";
    drag.current = {
      shell,
      left: box.left,
      width: box.width,
      share: current(event.currentTarget),
      startX: event.clientX,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || !state.width) return;
    if (!state.moved && Math.abs(event.clientX - state.startX) < DRAG_THRESHOLD) return;
    state.moved = true;
    state.share = clampChatShare((event.clientX - state.left) / state.width);
    state.shell.style.setProperty("--chat-share", String(state.share));
  };

  const endDrag = () => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    delete state.shell.dataset.resizing;
    if (state.moved) onChange(state.share);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = current(event.currentTarget);
    const next =
      event.key === "ArrowLeft"
        ? base - STEP
        : event.key === "ArrowRight"
          ? base + STEP
          : event.key === "Home"
            ? CHAT_SHARE.min
            : event.key === "End"
              ? CHAT_SHARE.max
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onChange(clampChatShare(next));
  };

  const now = Math.round((share ?? CHAT_SHARE.default) * 100);
  return (
    <div
      className="split-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat and map"
      aria-valuemin={Math.round(CHAT_SHARE.min * 100)}
      aria-valuemax={Math.round(CHAT_SHARE.max * 100)}
      aria-valuenow={now}
      aria-valuetext={`Chat ${now}% of the width`}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onChange(undefined)}
      onKeyDown={onKeyDown}
    />
  );
}
