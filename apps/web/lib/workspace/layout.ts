import type { FactKey } from "./trip-facts";

export type MobileView = "chat" | "map" | "trip" | "mine";
export const PHONE_VIEWS: readonly MobileView[] = ["chat", "map", "trip", "mine"];
export type DialogKind = "settings";

export type Drawer = "trip" | "nav" | "chats";

export type Media = { phone: boolean; narrow: boolean };

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
  | { type: "close-drawer" }
  | { type: "open-fact"; fact: FactKey }
  | { type: "close-fact" }
  | { type: "open-sheet" }
  | { type: "close-sheet" }
  | { type: "open-dialog"; dialog: DialogKind }
  | { type: "close-dialog" }
  | { type: "show-trips" }
  | { type: "select-view"; view: MobileView }
  | { type: "chat-opened" }
  | { type: "trip-opened" }
  | { type: "chat-started"; fact?: FactKey }
  | { type: "resize"; from: Media };

type Panel = Pick<Surface, "drawer" | "sheet" | "fact">;

const strip = (surface: Surface): Surface =>
  Object.fromEntries(Object.entries(surface).filter(([, value]) => value !== undefined)) as Surface;

const only = (surface: Surface, panel: Panel & Partial<Pick<Surface, "page" | "view">>) =>
  strip({ page: surface.page, view: surface.view, dialog: surface.dialog, ...panel });
const without = (surface: Surface, key: keyof Panel | "dialog"): Surface =>
  strip({ ...surface, [key]: undefined });

const wideView = (view: MobileView): MobileView => (view === "map" ? "map" : "chat");

export function restoreLayout(view: unknown, media: Media): Surface {
  const saved = PHONE_VIEWS.includes(view as MobileView) ? (view as MobileView) : "chat";
  return { page: "workspace", view: media.phone ? saved : wideView(saved) };
}

export function layout(surface: Surface, event: LayoutEvent, media: Media): Surface {
  switch (event.type) {
    case "open-trip":
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

function cross(surface: Surface, from: Media, to: Media): Surface {
  let next = surface;
  if (!from.phone && to.phone) {
    if (next.page === "trips") next = { ...next, page: "workspace", view: "mine" };
    else if (next.drawer === "trip") next = { ...next, view: "trip" };
    next = without(next, "drawer");
  }
  if (from.phone && !to.phone) {
    next = without(next, "sheet");

    if (next.view === "trip")
      next = { ...next, view: "chat", ...(next.fact ? {} : { drawer: "trip" }) };
    else if (next.view === "mine") next = { ...without(next, "fact"), page: "trips", view: "chat" };
  }

  if (next.drawer === "nav" && (!to.narrow || to.phone)) next = without(next, "drawer");
  if (next.drawer === "chats" && to.narrow) next = without(next, "drawer");
  return next;
}
