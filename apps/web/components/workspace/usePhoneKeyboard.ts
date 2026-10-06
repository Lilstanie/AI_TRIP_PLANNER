"use client";
import { useEffect, useState } from "react";

/**
 * Fields whose focus means the traveller is typing: the composer, a structured question, the
 * trip-fact editors (bottom sheets on phones) and the stop editor in the Trip list.
 */
const TYPING_SCOPE = ".chat__form, .question, .fact-popover, .item-editor";

/** The nearest ancestor below `root` that scrolls its content vertically. */
function scrollParent(node: HTMLElement, root: HTMLElement) {
  for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    )
      return parent;
  }
  return null;
}

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
        !!active.closest(TYPING_SCOPE);
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
        // Fixed overlays (the fact sheets) sit on the layout viewport; this is how much of its
        // bottom the keyboard, or Safari's panning, leaves out of sight.
        app.style.setProperty(
          "--phone-keyboard-inset",
          `${Math.max(0, window.innerHeight - offset - height)}px`,
        );
      }
      app.toggleAttribute("data-phone-keyboard", open);
      setKeyboardOpen(open);
      if (open) {
        // Scroll only the transcript, never the document or its focused textarea.
        const stream = app.querySelector<HTMLElement>(".chat__stream");
        if (stream) stream.scrollTop = stream.scrollHeight;
        // A question's option list, a fact sheet's fields and the Trip list each scroll on their
        // own. Keyboard contraction can clip the already-focused field without causing another
        // focus event; reveal it in that container rather than scrolling the document. The stop
        // editor is revealed whole, so its Save button comes into view with the field.
        if (active instanceof HTMLElement) {
          const container = scrollParent(active, app);
          if (container) {
            const box = container.getBoundingClientRect();
            const editor = active.closest<HTMLElement>(".item-editor")?.getBoundingClientRect();
            const target =
              editor && editor.height <= box.height ? editor : active.getBoundingClientRect();
            if (target.bottom > box.bottom) container.scrollTop += target.bottom - box.bottom;
            else if (target.top < box.top) container.scrollTop -= box.top - target.top;
          }
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
      app.style.removeProperty("--phone-keyboard-inset");
      app.removeAttribute("data-phone-keyboard");
    };
  }, [enabled]);
  return { keyboardOpen };
}
