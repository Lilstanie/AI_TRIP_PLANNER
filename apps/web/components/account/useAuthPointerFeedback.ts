"use client";

import { useEffect, useRef } from "react";

export function useAuthPointerFeedback() {
  const pageRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const pointer = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const staticSurface = window.matchMedia(
      "(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)",
    );
    let frame = 0;
    let x = 0;
    let y = 0;
    let enabled = false;

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      delete page!.dataset.pointerActive;
      if (formRef.current) delete formRef.current.dataset.pointerActive;
    }

    function refresh() {
      enabled = pointer.matches && !staticSurface.matches && !document.hidden;
      if (!enabled) reset();
    }

    function paint() {
      frame = 0;
      if (!enabled) return;
      const bounds = page!.getBoundingClientRect();
      page!.style.setProperty("--auth-pointer-x", `${x - bounds.left}px`);
      page!.style.setProperty("--auth-pointer-y", `${y - bounds.top}px`);
      page!.dataset.pointerActive = "true";
      const form = formRef.current;
      if (!form) return;
      const card = form.getBoundingClientRect();
      const inside = x >= card.left && x <= card.right && y >= card.top && y <= card.bottom;
      if (inside) {
        form.style.setProperty("--auth-pointer-x", `${x - card.left}px`);
        form.style.setProperty("--auth-pointer-y", `${y - card.top}px`);
        form.dataset.pointerActive = "true";
      } else {
        delete form.dataset.pointerActive;
      }
    }

    function move(event: PointerEvent) {
      if (!enabled || event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    }

    refresh();
    page.addEventListener("pointermove", move, { passive: true });
    page.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("scroll", reset, { passive: true });
    window.addEventListener("resize", reset);
    document.addEventListener("visibilitychange", refresh);
    pointer.addEventListener("change", refresh);
    staticSurface.addEventListener("change", refresh);
    return () => {
      reset();
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("scroll", reset);
      window.removeEventListener("resize", reset);
      document.removeEventListener("visibilitychange", refresh);
      pointer.removeEventListener("change", refresh);
      staticSurface.removeEventListener("change", refresh);
    };
  }, []);

  return { pageRef, formRef };
}
