// What is open on screen, tested only through `layout()` and `restoreLayout()`.
// Failure inventory, written before the reducer:
// - Narrowing to phone width from Your trips leaves no tab bar or lands on Chat instead of Mine (#184).
// - Narrowing with the Trip drawer open closes it instead of showing the Trip tab.
// - Widening from the Trip tab drops the traveller in Chat with the drawer closed.
// - Widening from Mine shows the workspace instead of Your trips.
// - Widening from Chat or Map changes the view.
// - A crossing while Settings or Review is open closes the dialog, or skips the mapping underneath it.
// - The navigation drawer or Chats panel stays open on a layout that does not render it.
// - The phone trip facts sheet survives on a layout that has no phone top bar.
// - Opening a panel while another is open leaves two panels open.
// - Opening Settings or Review closes the panel beneath it.
// - A reload on desktop or a tablet restores a phone-only tab, or opens a panel.
// - A non-phone layout is asked for the Trip or Mine tab and shows an empty view.
// - Opening a chat or trip, or starting one, leaves a drawer, dialog or Your trips over it, or
//   changes the tablet Map view when a trip is opened.
import { describe, expect, it } from "vitest";
import { layout, restoreLayout, type LayoutEvent, type Surface } from "@/lib/workspace/layout";

const DESKTOP = { phone: false, narrow: false };
const TABLET = { phone: false, narrow: true };
const PHONE = { phone: true, narrow: true };
const workspace = (view: Surface["view"] = "chat"): Surface => ({ page: "workspace", view });

/** Applies events in order, each with the media that is current when it happens. */
function play(start: Surface, ...steps: [LayoutEvent, typeof DESKTOP][]) {
  return steps.reduce((surface, [event, media]) => layout(surface, event, media), start);
}
/** A window resize from one breakpoint to another. */
const resize = (from: typeof DESKTOP, to: typeof DESKTOP): [LayoutEvent, typeof DESKTOP] => [
  { type: "resize", from },
  to,
];

describe("crossing the phone width", () => {
  it("continues Your trips in the Mine tab (#184)", () => {
    const trips = layout(workspace(), { type: "show-trips" }, TABLET);
    expect(layout(trips, { type: "resize", from: TABLET }, PHONE)).toEqual(workspace("mine"));
  });

  it("shows the Trip tab when the Trip drawer was open", () => {
    const open = layout(workspace("map"), { type: "open-trip" }, DESKTOP);
    expect(layout(open, { type: "resize", from: DESKTOP }, PHONE)).toEqual(workspace("trip"));
  });

  it("opens the Trip drawer when widening from the Trip tab", () => {
    expect(layout(workspace("trip"), { type: "resize", from: PHONE }, DESKTOP)).toEqual({
      page: "workspace",
      view: "chat",
      drawer: "trip",
    });
  });

  it("returns to Your trips when widening from Mine", () => {
    expect(layout(workspace("mine"), { type: "resize", from: PHONE }, TABLET)).toEqual({
      page: "trips",
      view: "chat",
    });
  });

  it("keeps Chat and Map when widening and narrowing", () => {
    for (const view of ["chat", "map"] as const) {
      expect(play(workspace(view), resize(PHONE, TABLET))).toEqual(workspace(view));
      expect(play(workspace(view), resize(TABLET, PHONE))).toEqual(workspace(view));
    }
  });

  it("round-trips the Trip drawer and Your trips across the phone width", () => {
    const trip = { page: "workspace", view: "chat", drawer: "trip" } as const;
    expect(play(trip, resize(DESKTOP, PHONE), resize(PHONE, DESKTOP))).toEqual(trip);
    const trips = { page: "trips", view: "chat" } as const;
    expect(play(trips, resize(TABLET, PHONE), resize(PHONE, TABLET))).toEqual(trips);
  });

  it("keeps an open dialog and still maps the panel beneath it", () => {
    const start = play(
      workspace(),
      [{ type: "open-trip" }, DESKTOP],
      [{ type: "open-dialog", dialog: "settings" }, DESKTOP],
    );
    expect(play(start, resize(DESKTOP, PHONE))).toEqual({
      page: "workspace",
      view: "trip",
      dialog: "settings",
    });
    const review = layout(workspace("mine"), { type: "open-dialog", dialog: "review" }, PHONE);
    expect(play(review, resize(PHONE, TABLET))).toEqual({
      page: "trips",
      view: "chat",
      dialog: "review",
    });
  });

  it("keeps a chip editor open across the phone width", () => {
    const editing = layout(workspace(), { type: "open-fact", fact: "budget" }, DESKTOP);
    expect(play(editing, resize(DESKTOP, PHONE), resize(PHONE, DESKTOP))).toEqual(editing);
  });

  it("keeps a chip editor as the one panel when widening from the Trip tab", () => {
    const editing = layout(workspace("trip"), { type: "open-fact", fact: "when" }, PHONE);
    expect(play(editing, resize(PHONE, DESKTOP))).toEqual({ ...workspace("chat"), fact: "when" });
  });

  it("closes a chip editor when widening from Mine, as Your trips has no chips", () => {
    const editing = layout(workspace("mine"), { type: "open-fact", fact: "who" }, PHONE);
    expect(play(editing, resize(PHONE, TABLET))).toEqual({ page: "trips", view: "chat" });
  });

  it("closes the trip facts sheet when the phone top bar goes away", () => {
    const sheet = layout(workspace("map"), { type: "open-sheet" }, PHONE);
    expect(sheet.sheet).toBe("facts");
    expect(play(sheet, resize(PHONE, TABLET))).toEqual(workspace("map"));
  });

  it("closes the navigation drawer when leaving the narrow layout", () => {
    const nav = layout(workspace("map"), { type: "open-nav" }, TABLET);
    expect(nav.drawer).toBe("nav");
    expect(play(nav, resize(TABLET, DESKTOP))).toEqual(workspace("map"));
    expect(play(nav, resize(TABLET, PHONE))).toEqual(workspace("map"));
  });

  it("closes the Chats panel when narrowing, where the sidebar is a drawer", () => {
    const chats = layout(workspace(), { type: "toggle-chats" }, DESKTOP);
    expect(chats.drawer).toBe("chats");
    expect(play(chats, resize(DESKTOP, TABLET))).toEqual(workspace());
  });

  it("changes nothing for a resize that stays on one side of every breakpoint", () => {
    const trip = layout(workspace(), { type: "open-trip" }, TABLET);
    expect(layout(trip, { type: "resize", from: TABLET }, TABLET)).toEqual(trip);
  });
});

describe("one open panel", () => {
  it("closes the Trip drawer and navigation when a chip editor opens", () => {
    for (const [open, media] of [
      [{ type: "open-trip" }, DESKTOP],
      [{ type: "open-nav" }, TABLET],
      [{ type: "toggle-chats" }, DESKTOP],
    ] as const) {
      expect(
        play(workspace(), [open, media], [{ type: "open-fact", fact: "where" }, media]),
      ).toEqual({ page: "workspace", view: "chat", fact: "where" });
    }
  });

  it("closes a chip editor and the trip facts sheet when the Trip drawer opens", () => {
    expect(
      play(
        workspace(),
        [{ type: "open-fact", fact: "who" }, DESKTOP],
        [{ type: "open-trip" }, DESKTOP],
      ),
    ).toEqual({ page: "workspace", view: "chat", drawer: "trip" });
    expect(
      play(workspace("map"), [{ type: "open-sheet" }, PHONE], [{ type: "open-trip" }, PHONE]),
    ).toEqual(workspace("trip"));
  });

  it("replaces one drawer with another", () => {
    expect(
      play(workspace(), [{ type: "open-trip" }, TABLET], [{ type: "open-nav" }, TABLET]),
    ).toEqual({ page: "workspace", view: "chat", drawer: "nav" });
    expect(
      play(workspace(), [{ type: "toggle-chats" }, DESKTOP], [{ type: "open-trip" }, DESKTOP]),
    ).toEqual({ page: "workspace", view: "chat", drawer: "trip" });
  });

  it("lets a fact picked from the trip facts sheet take its place", () => {
    expect(
      play(
        workspace(),
        [{ type: "open-sheet" }, PHONE],
        [{ type: "open-fact", fact: "when" }, PHONE],
      ),
    ).toEqual({ page: "workspace", view: "chat", fact: "when" });
  });

  it("opens Settings or Review on top of the open panel and returns to it", () => {
    for (const [open, media] of [
      [{ type: "open-trip" }, DESKTOP],
      [{ type: "open-nav" }, TABLET],
      [{ type: "open-sheet" }, PHONE],
    ] as const) {
      const panel = layout(workspace(), open, media);
      const dialog = layout(panel, { type: "open-dialog", dialog: "settings" }, media);
      expect(dialog).toEqual({ ...panel, dialog: "settings" });
      expect(layout(dialog, { type: "close-dialog" }, media)).toEqual(panel);
    }
  });

  it("closes a dialog when a chip editor opens, as a rejected brief does", () => {
    expect(
      play(
        workspace(),
        [{ type: "open-dialog", dialog: "review" }, DESKTOP],
        [{ type: "open-fact", fact: "budget" }, DESKTOP],
      ),
    ).toEqual({ page: "workspace", view: "chat", fact: "budget" });
  });

  it("closes only the panel it names", () => {
    const trip = layout(workspace(), { type: "open-trip" }, DESKTOP);
    expect(layout(trip, { type: "close-fact" }, DESKTOP)).toEqual(trip);
    expect(layout(trip, { type: "close-trip" }, DESKTOP)).toEqual(workspace());
    const nav = layout(workspace(), { type: "open-nav" }, TABLET);
    expect(layout(nav, { type: "close-trip" }, TABLET)).toEqual(nav);
    expect(layout(nav, { type: "close-drawer" }, TABLET)).toEqual(workspace());
    const chats = layout(workspace(), { type: "toggle-chats" }, DESKTOP);
    expect(layout(chats, { type: "toggle-chats" }, DESKTOP)).toEqual(workspace());
  });
});

describe("pages and views", () => {
  it("shows Your trips with every panel closed, and Mine on a phone", () => {
    const open = layout(workspace("map"), { type: "open-trip" }, DESKTOP);
    expect(layout(open, { type: "show-trips" }, DESKTOP)).toEqual({ page: "trips", view: "map" });
    const nav = layout(workspace(), { type: "open-nav" }, TABLET);
    expect(layout(nav, { type: "show-trips" }, TABLET)).toEqual({ page: "trips", view: "chat" });
    expect(layout(workspace(), { type: "show-trips" }, PHONE)).toEqual(workspace("mine"));
  });

  it("maps the phone-only tabs onto the wider layout's own controls", () => {
    expect(layout(workspace("map"), { type: "select-view", view: "trip" }, TABLET)).toEqual({
      page: "workspace",
      view: "map",
      drawer: "trip",
    });
    expect(layout(workspace("map"), { type: "select-view", view: "mine" }, TABLET)).toEqual({
      page: "trips",
      view: "map",
    });
    expect(layout(workspace(), { type: "select-view", view: "map" }, TABLET)).toEqual(
      workspace("map"),
    );
  });

  it("selects a phone tab without closing an open dialog", () => {
    const dialog = layout(workspace(), { type: "open-dialog", dialog: "settings" }, PHONE);
    expect(layout(dialog, { type: "select-view", view: "trip" }, PHONE)).toEqual({
      ...workspace("trip"),
      dialog: "settings",
    });
  });

  it("opens a chat in Chat with navigation, Chats and dialogs closed and the Trip drawer kept", () => {
    const start: Surface = { page: "trips", view: "map", drawer: "nav", dialog: "settings" };
    expect(layout(start, { type: "chat-opened" }, TABLET)).toEqual(workspace("chat"));
    const trip = layout(workspace("map"), { type: "open-trip" }, DESKTOP);
    expect(layout(trip, { type: "chat-opened" }, DESKTOP)).toEqual({ ...trip, view: "chat" });
  });

  it("opens a trip in Chat on a phone and keeps the tablet Map view", () => {
    const tablet = layout(workspace("map"), { type: "open-nav" }, TABLET);
    expect(layout(tablet, { type: "trip-opened" }, TABLET)).toEqual(workspace("map"));
    expect(layout(workspace("mine"), { type: "trip-opened" }, PHONE)).toEqual(workspace("chat"));
  });

  it("starts a chat in Chat with everything closed, and a trip on the Where editor", () => {
    const busy: Surface = {
      page: "workspace",
      view: "map",
      drawer: "trip",
      dialog: "review",
    };
    expect(layout(busy, { type: "chat-started" }, DESKTOP)).toEqual(workspace("chat"));
    expect(layout(busy, { type: "chat-started", fact: "where" }, DESKTOP)).toEqual({
      ...workspace("chat"),
      fact: "where",
    });
    expect(layout(workspace("mine"), { type: "chat-started" }, PHONE)).toEqual(workspace("chat"));
  });
});

describe("restoring after a reload", () => {
  it("restores the saved phone tab on a phone with every panel closed", () => {
    for (const view of ["chat", "map", "trip", "mine"] as const)
      expect(restoreLayout(view, PHONE)).toEqual(workspace(view));
  });

  it("falls back to Chat for a phone-only tab, without opening a panel, on wider layouts", () => {
    for (const media of [TABLET, DESKTOP]) {
      expect(restoreLayout("trip", media)).toEqual(workspace("chat"));
      expect(restoreLayout("mine", media)).toEqual(workspace("chat"));
      expect(restoreLayout("map", media)).toEqual(workspace("map"));
    }
  });

  it("ignores an unknown saved view", () => {
    expect(restoreLayout("nowhere", PHONE)).toEqual(workspace("chat"));
    expect(restoreLayout(undefined, DESKTOP)).toEqual(workspace("chat"));
  });
});
