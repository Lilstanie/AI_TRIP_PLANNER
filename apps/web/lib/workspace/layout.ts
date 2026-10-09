import type { FactKey } from "./trip-facts";

/**
 * Narrow screens show one view at a time. Up to 1000 px that is chat or map, with trip and
 * navigation as drawers; phones (520 px and narrower) add the Trip and Mine tabs instead.
 */
export type MobileView = "chat" | "map" | "trip" | "mine";
export const PHONE_VIEWS: readonly MobileView[] = ["chat", "map", "trip", "mine"];
export type DialogKind = "settings";
/**
 * Panels that slide over the workspace: Your Trip, the 521–1000 px navigation and the desktop
 * Chats panel beside the sidebar.
 */
export type Drawer = "trip" | "nav" | "chats";
/** The breakpoints the workspace reads: phone is 520 px and narrower, narrow is 1000 px. */
export type Media = { phone: boolean; narrow: boolean };

/**
 * What is open on screen. `page` is the workspace or the Your trips page; `view` is the selected
 * phone tab or narrow-layout view, kept while Your trips is shown so returning restores it.
 * At most one panel (`drawer`, the phone trip facts `sheet`, or the chip editor `fact`) is open;
 * Settings (`dialog`) may sit on top of it. Your trips never has a chip editor, the
 * facts sheet or the Trip drawer, and a phone never shows Your trips or a drawer.
 */
export type Surface = {
  page: "workspace" | "trips";
  view: MobileView;
  drawer?: Drawer;
  sheet?: "facts";
  fact?: FactKey;
  dialog?: DialogKind;
};

export type LayoutEvent =
  | { type: "open-trip" }
  | { type: "close-trip" }
  | { type: "open-nav" }
  | { type: "toggle-chats" }
  /** Closes whichever drawer is open: a backdrop press, Escape, or a press outside Chats. */
  | { type: "close-drawer" }
  | { type: "open-fact"; fact: FactKey }
  | { type: "close-fact" }
  | { type: "open-sheet" }
  | { type: "close-sheet" }
  | { type: "open-dialog"; dialog: DialogKind }
  | { type: "close-dialog" }
  | { type: "show-trips" }
  | { type: "select-view"; view: MobileView }
  /** A saved chat was opened. */
  | { type: "chat-opened" }
  /** A saved trip was opened. */
  | { type: "trip-opened" }
  /** New chat, or New trip with `fact: "where"`. */
  | { type: "chat-started"; fact?: FactKey }
  /** The window crossed a breakpoint; the media passed to `layout` is the new one. */
  | { type: "resize"; from: Media };

type Panel = Pick<Surface, "drawer" | "sheet" | "fact">;

/** Drops keys whose value is undefined, so equal surfaces compare equal. */
const strip = (surface: Surface): Surface =>
  Object.fromEntries(Object.entries(surface).filter(([, value]) => value !== undefined)) as Surface;
/** Replaces every open panel with `panel`, keeping the page, view and dialog unless given. */
const only = (surface: Surface, panel: Panel & Partial<Pick<Surface, "page" | "view">>) =>
  strip({ page: surface.page, view: surface.view, dialog: surface.dialog, ...panel });
const without = (surface: Surface, key: keyof Panel | "dialog"): Surface =>
  strip({ ...surface, [key]: undefined });
/** The views a layout wider than a phone has; the phone-only tabs fall back to Chat. */
const wideView = (view: MobileView): MobileView => (view === "map" ? "map" : "chat");

/** The surface a reload starts with: the saved view where it exists, and every panel closed. */
export function restoreLayout(view: unknown, media: Media): Surface {
  const saved = PHONE_VIEWS.includes(view as MobileView) ? (view as MobileView) : "chat";
  return { page: "workspace", view: media.phone ? saved : wideView(saved) };
}

/** Applies one event to what is open on screen, given the breakpoints current after it. */
export function layout(surface: Surface, event: LayoutEvent, media: Media): Surface {
  switch (event.type) {
    case "open-trip":
      // On a phone Your Trip is a tab, not a drawer.
      return media.phone
        ? only(surface, { page: "workspace", view: "trip" })
        : only(surface, { page: "workspace", drawer: "trip" });
    case "close-trip":
      return surface.drawer === "trip" ? without(surface, "drawer") : surface;
    case "open-nav":
      return only(surface, { drawer: "nav" });
    case "toggle-chats":
      return surface.drawer === "chats"
        ? without(surface, "drawer")
        : only(surface, { drawer: "chats" });
    case "close-drawer":
      return without(surface, "drawer");
    case "open-fact":
      // An editor replaces a dialog too, so a chip editor opened while Settings is up takes its place.
      return only(without(surface, "dialog"), { page: "workspace", fact: event.fact });
    case "close-fact":
      return without(surface, "fact");
    case "open-sheet":
      return only(surface, { sheet: "facts" });
    case "close-sheet":
      return without(surface, "sheet");
    case "open-dialog":
      return { ...surface, dialog: event.dialog };
    case "close-dialog":
      return without(surface, "dialog");
    case "show-trips":
      // A phone has no Your trips page; Mine lists the same trips.
      return media.phone
        ? only(surface, { page: "workspace", view: "mine" })
        : only(surface, { page: "trips" });
    case "select-view":
      if (!media.phone && event.view === "trip")
        return layout(surface, { type: "open-trip" }, media);
      if (!media.phone && event.view === "mine")
        return layout(surface, { type: "show-trips" }, media);
      return { ...surface, page: "workspace", view: event.view };
    case "chat-opened":
    case "trip-opened":
      // Opening history keeps the Trip drawer and a chip editor, and closes everything else.
      // Opening a trip keeps a wider layout's Chat or Map view; everything else returns to Chat.
      return strip({
        page: "workspace",
        view: event.type === "trip-opened" && !media.phone ? surface.view : "chat",
        drawer: surface.drawer === "trip" ? "trip" : undefined,
        fact: surface.fact,
      });
    case "chat-started":
      return strip({ page: "workspace", view: "chat", fact: event.fact });
    case "resize":
      return cross(surface, event.from, media);
  }
}

/**
 * Keeps the traveller on the same thing across a breakpoint: the Trip drawer and the Trip tab,
 * and Your trips and the Mine tab, become each other. Dialogs and chip editors stay open.
 */
function cross(surface: Surface, from: Media, to: Media): Surface {
  let next = surface;
  if (!from.phone && to.phone) {
    if (next.page === "trips") next = { ...next, page: "workspace", view: "mine" };
    else if (next.drawer === "trip") next = { ...next, view: "trip" };
    next = without(next, "drawer");
  }
  if (from.phone && !to.phone) {
    next = without(next, "sheet");
    // An open chip editor stays the one panel; the Trip drawer opens only without it.
    if (next.view === "trip")
      next = { ...next, view: "chat", ...(next.fact ? {} : { drawer: "trip" }) };
    else if (next.view === "mine") next = { ...without(next, "fact"), page: "trips", view: "chat" };
  }
  // The navigation drawer exists only between 521 and 1000 px; the Chats panel only above it.
  if (next.drawer === "nav" && (!to.narrow || to.phone)) next = without(next, "drawer");
  if (next.drawer === "chats" && to.narrow) next = without(next, "drawer");
  return next;
}
