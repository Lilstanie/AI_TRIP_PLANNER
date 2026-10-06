# Agent Note: Phones get their own shell with a bottom tab bar

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

At 520 px and narrower the workspace was the desktop layout squeezed narrow. The top bar took two
rows (menu, fact chips and Trip, then a Chat/Map switch), the fact chips scrolled sideways, Your Trip
was a full-width drawer that hid the map, switching chats or trips started from a menu drawer, the
keyboard pushed the composer around, and map controls and stop menus were small for a thumb. The
owner confirmed every one of these in the installed app (iPhone Add to Home Screen, Android TWA) and
asked for a phone-first design. Spec: issue #174.

## Decision

- **Phones only.** `useIsPhone()` matches `(max-width: 520px)` and sets `data-phone` on
  `.workspace-app`. Desktop and the 521–1000 px narrow layout keep their own controls.
- **Bottom tab bar** (`PhoneTabBar`): Chat, Map, Trip and Mine, a `tablist` whose tabs control one
  `tabpanel` each in the workspace shell. It replaces the menu button, the navigation drawer, the
  Chat/Map switch and the top-bar Trip button. The selected tab is the workspace's mobile view
  (`chat | map | trip | mine`), saved in the catalog layout; between 521 and 1000 px a saved Trip or
  Mine falls back to Chat.
- **One-row top bar** with the trip title. The fact chips are hidden on phones but stay mounted, so
  their editors still open (as bottom sheets) from the trip facts sheet the title opens.
- **Trip tab** renders Your Trip in place; `openTrip()` selects the tab on a phone instead of
  opening the drawer, and the drawers are closed whenever the phone shell takes over.
- **Mine tab** reuses ChatsPanel and an embedded TripsPage, including its calendar. Search filters
  both lists, every open/new action returns to Chat, and touch row menus stay visible. Settings &
  account, data mode and language live here.
- **Map tab** fills its panel and filters markers/routes by the day chosen in PhoneMapSheet. Its
  handle supports three snap heights through pointer gestures and keyboard actions. Place details
  become a bottom sheet on phones; no-key users can still browse the stops.
- **Keyboard** follows VisualViewport height and offset; a focused chat/question field plus a
  contracted viewport hides navigation. Only the transcript scrolls to keep the last reply visible.
- **Updates** track read plan content per trip, with object keys normalized so restored snapshots
  match their live plans. Existing saved history is the baseline; switching unchanged trips does not
  mark them updated. Replanning and manual edits on the same trip/round both mark Trip unread. The
  dot clears on Trip and never changes the selected tab.
- **Back** adds one temporary same-URL history entry while an editor, dialog, menu or fully
  expanded map stops sheet is visible. Back uses the existing cancel/Escape close paths, and normal
  closes consume the temporary entry; an entry left over from before a reload is dropped.
- **Safe areas**: the viewport uses `viewport-fit=cover`; every layout pads with
  `env(safe-area-inset-*)`, and on phones the top bar and tab bar carry the insets.
- Phone styles live in `app/styles/phone*.css`, loaded last; strings in `lib/i18n/phone-messages.ts`.
- Stops are reordered from the item action menu (Move earlier / Move later), never by dragging.

## Alternatives considered

- **Patch each problem inside the narrow layout.** Smallest diff, but every fix fought the
  desktop structure (two-row top bar, drawers over a single view), and the owner judged most
  problems to come from that structure itself.
- **Three tabs with navigation still behind a menu.** Keeps chat and trip switching several taps
  deep, which was one of the confirmed problems.
- **Two tabs with the map merged into Trip.** Halves the map's height, the other confirmed problem.
- **Apply the tab bar up to 1000 px.** Tablets have room for chat and map side by side or switched
  in place; the owner limited the change to phones.
- **Drag-and-drop stop reordering.** Conflicts with page scrolling on touch screens and needs a
  separate keyboard path; menu actions are reliable and accessible.

## Consequences

- Two layouts share one component tree, so a new workspace control must decide where it lives on a
  phone (top bar, a tab, or Mine) as well as on desktop.
- `phone-shell.e2e.mjs` at 390 × 844 and 360 × 800 is the regression check for the shell; it runs
  against a production build because dev-server reloads interrupt long walks. The same command runs
  the bounded phone-mine, phone-map and phone-state walks and combines their reports.
- Safe areas and the real on-screen keyboard are checked by hand on devices (#182).
