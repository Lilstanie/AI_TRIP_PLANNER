"use client";
import { useEffect, useState } from "react";

/** Follow the visible screen, including keyboard animation and Safari's viewport panning. */
export function usePhoneKeyboard(enabled: boolean) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setKeyboardOpen(false);
      return;
    }
    const app = document.querySelector<HTMLElement>(".workspace-app");
    if (!app) return;
    const viewport = window.visualViewport;
    let frame = 0;
    // Some Android browsers also resize the layout viewport when the keyboard opens. Keep the
    // largest unfocused height as the baseline rather than relying on innerHeight alone.
    let baseline = Math.max(window.innerHeight, viewport?.height ?? 0);
    const update = () => {
      frame = 0;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        active.matches('textarea, input:not([type="button"]):not([type="submit"])') &&
        !!active.closest(".chat__form, .question");
      const height = viewport?.height ?? window.innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      if (!typing) baseline = Math.max(baseline, window.innerHeight, height);
      // Browser chrome and pinch zoom are not a keyboard. Focus plus a substantial contraction
      // is required; focusing with a hardware keyboard leaves navigation available.
      const open = typing && (viewport?.scale ?? 1) === 1 && baseline - height > 120;
      // Pinch zoom shrinks the visual viewport too; following it would shrink the whole app
      // instead of magnifying it, so the shell keeps its last unzoomed size while zoomed.
      if ((viewport?.scale ?? 1) === 1) {
        app.style.setProperty("--phone-viewport-height", `${height}px`);
        app.style.setProperty("--phone-viewport-top", `${offset}px`);
      }
      app.toggleAttribute("data-phone-keyboard", open);
      setKeyboardOpen(open);
      if (open) {
        // Scroll only the transcript, never the document or its focused textarea.
        const stream = app.querySelector<HTMLElement>(".chat__stream");
        if (stream) stream.scrollTop = stream.scrollHeight;
        // A question's option list has its own scroll viewport above a fixed footer. Keyboard
        // contraction can clip the already-focused custom field without causing another focus
        // event; reveal it in that list rather than scrolling its card or the document.
        const body =
          active instanceof HTMLElement ? active.closest<HTMLElement>(".question__body") : null;
        if (body && active instanceof HTMLElement) {
          const fieldBox = active.getBoundingClientRect();
          const bodyBox = body.getBoundingClientRect();
          if (fieldBox.bottom > bodyBox.bottom) body.scrollTop += fieldBox.bottom - bodyBox.bottom;
          else if (fieldBox.top < bodyBox.top) body.scrollTop -= bodyBox.top - fieldBox.top;
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      app.style.removeProperty("--phone-viewport-height");
      app.style.removeProperty("--phone-viewport-top");
      app.removeAttribute("data-phone-keyboard");
    };
  }, [enabled]);
  return { keyboardOpen };
}
