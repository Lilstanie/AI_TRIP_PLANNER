"use client";
import { useEffect } from "react";

const OVERLAYS =
  'dialog[open], [role="dialog"], [role="menu"], .item-editor, .phone-map-sheet[data-snap="full"]';
const HISTORY_KEY = "tripPhoneOverlay";

export function usePhoneBack(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    if (history.state?.[HISTORY_KEY])
      history.replaceState({ ...history.state, [HISTORY_KEY]: undefined }, "", location.href);
    let guarded = false;
    let removing = false;
    let frame = 0;
    const visibleOverlays = () =>
      [...document.querySelectorAll<HTMLElement>(OVERLAYS)].filter(
        (node) =>
          !node.closest('[hidden], [inert], [aria-hidden="true"], [data-leaving="true"]') &&
          node.getClientRects().length > 0,
      );
    const sync = () => {
      frame = 0;
      if (removing) return;
      if (visibleOverlays().length) {
        if (!guarded) {
          history.pushState({ ...history.state, [HISTORY_KEY]: true }, "", location.href);
          guarded = true;
        }
      } else if (guarded) {
        guarded = false;
        removing = true;
        history.back();
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    const onBack = () => {
      if (removing) {
        removing = false;
        schedule();
        return;
      }
      if (!guarded) {
        if (history.state?.[HISTORY_KEY]) {
          if (visibleOverlays().length) guarded = true;
          else {
            removing = true;
            history.back();
          }
        }
        return;
      }
      guarded = false;
      const overlays = visibleOverlays();

      const native = overlays.filter((node) => node instanceof HTMLDialogElement).at(-1);
      if (native) native.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true }));
      else {
        const focused = document.activeElement;
        const top =
          [...overlays]
            .reverse()
            .find((node) => focused instanceof Node && node.contains(focused)) ?? overlays.at(-1);
        top?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      }

      schedule();
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "open",
        "hidden",
        "inert",
        "aria-hidden",
        "data-leaving",
        "class",
        "data-snap",
      ],
    });
    window.addEventListener("popstate", onBack);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", onBack);

      if (guarded && history.state?.[HISTORY_KEY]) history.back();
    };
  }, [enabled]);
}
