"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  layout,
  restoreLayout,
  type LayoutEvent,
  type Media,
  type MobileView,
} from "@/lib/workspace/layout";

const NARROW_QUERY = "(max-width: 1000px)";
const PHONE_QUERY = "(max-width: 520px)";

const matches = (query: string) =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(query).matches;
const readMedia = (): Media => ({ phone: matches(PHONE_QUERY), narrow: matches(NARROW_QUERY) });

/**
 * What is open on screen, from `layout()`. The workspace mounts only after storage is read on the
 * client, so the first render already knows the real breakpoints and a reload never replays a
 * crossing. Later media-query changes become `resize` events.
 */
export function useWorkspaceLayout(savedView: MobileView) {
  const [media, setMedia] = useState(readMedia);
  const current = useRef(media);
  const [surface, setSurface] = useState(() => restoreLayout(savedView, current.current));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const queries = [window.matchMedia(PHONE_QUERY), window.matchMedia(NARROW_QUERY)];
    const update = () => {
      const from = current.current;
      const to = readMedia();
      if (from.phone === to.phone && from.narrow === to.narrow) return;
      current.current = to;
      setMedia(to);
      setSurface((surface) => layout(surface, { type: "resize", from }, to));
    };
    // The window may have crossed a breakpoint between the first render and this effect.
    update();
    for (const query of queries) query.addEventListener("change", update);
    return () => {
      for (const query of queries) query.removeEventListener("change", update);
    };
  }, []);

  const dispatch = useCallback(
    (event: LayoutEvent) => setSurface((surface) => layout(surface, event, current.current)),
    [],
  );
  return { surface, phone: media.phone, narrow: media.narrow, dispatch };
}
