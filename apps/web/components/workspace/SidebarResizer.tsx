"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SIDEBAR_WIDTH, clampSidebarWidth } from "@/lib/workspace/catalog";

const STEP = 16;

const DRAG_THRESHOLD = 3;

export function SidebarResizer({
  width,
  onChange,
}: {
  width?: number;
  onChange(width: number | undefined): void;
}) {
  const { t } = useLocale();
  const drag = useRef<{
    app: HTMLElement;
    left: number;
    width: number;
    startX: number;
    moved: boolean;
  }>(null);
  const resizeHandle = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState<number>();

  const current = (handle: HTMLElement) =>
    width ??
    (handle.parentElement?.querySelector(".workspace-sidebar")?.getBoundingClientRect().width ||
      SIDEBAR_WIDTH.default);

  useEffect(() => {
    if (width !== undefined) return;
    const measure = () => {
      const sidebar = resizeHandle.current?.parentElement?.querySelector(".workspace-sidebar");
      const measured = Math.round(sidebar?.getBoundingClientRect().width ?? 0);
      if (measured > 0) setRendered(measured);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [width]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const app = event.currentTarget.parentElement;
    if (!app) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    app.dataset.resizing = "true";
    drag.current = {
      app,
      left: app.getBoundingClientRect().left,
      width: current(event.currentTarget),
      startX: event.clientX,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;

    if (!state.moved && Math.abs(event.clientX - state.startX) < DRAG_THRESHOLD) return;
    state.width = clampSidebarWidth(event.clientX - state.left);
    state.moved = true;
    state.app.style.setProperty("--sidebar-width", `${state.width}px`);
  };

  const endDrag = () => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    delete state.app.dataset.resizing;

    if (state.moved) onChange(state.width);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = current(event.currentTarget);
    const next =
      event.key === "ArrowLeft"
        ? base - STEP
        : event.key === "ArrowRight"
          ? base + STEP
          : event.key === "Home"
            ? SIDEBAR_WIDTH.min
            : event.key === "End"
              ? SIDEBAR_WIDTH.max
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onChange(clampSidebarWidth(next));
  };

  return (
    <div
      ref={resizeHandle}
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t("Resize sidebar")}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      aria-valuenow={width ?? rendered ?? SIDEBAR_WIDTH.default}
      tabIndex={0}
      title={t("Drag to resize · double-click to reset")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onChange(undefined)}
      onKeyDown={onKeyDown}
    />
  );
}
