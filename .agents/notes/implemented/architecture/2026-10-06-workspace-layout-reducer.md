# Agent Note: One layout decision owns what is open, including across the phone width

Status: implemented

## Problem

What was open on screen lived in seven pieces of controller state (page, phone tab, Trip drawer,
navigation drawer, Chats panel, chip editor, dialog) plus the phone trip facts sheet inside its own
component. Three effects reconciled them after a breakpoint change, and four hand-written blocks
closed "everything else" before opening a panel, each with a slightly different list. The result
depended on how the traveller got there: narrowing to phone width with the Trip drawer open closed it
instead of showing the Trip tab, and widening from the Trip tab dropped the traveller in Chat. #184
(Your trips at phone width had no way back) was fixed in one of those effects and checked only in a
browser. Spec #196, ticket #198.

## Decision

- `apps/web/lib/workspace/layout.ts` exports the pure function
  `layout(surface, event, {phone, narrow}) → Surface` and `restoreLayout(savedView, media)`.
  A `Surface` is `{page, view, drawer?, sheet?, fact?, dialog?}`: the workspace or Your trips page,
  the phone tab or narrow view (kept while Your trips shows), at most one panel (a drawer — Trip,
  navigation or the desktop Chats panel — the phone trip facts sheet, or one chip editor), and
  Settings or Review on top.
- Opening any panel closes the others. Settings and Review open over the open panel and return to it
  when they close; opening a chip editor still closes a dialog, as a rejected brief does from Review.
- Crossing a breakpoint is a `resize` event carrying the previous media:
  - narrowing to phone width: Trip drawer → Trip tab, Your trips → Mine tab, other drawers close;
  - widening from a phone: Trip tab → Trip drawer (over Chat), Mine tab → Your trips, Chat and Map
    stay, the trip facts sheet closes; an open chip editor stays the one panel instead of the drawer;
  - the navigation drawer closes outside 521–1000 px and the Chats panel closes at 1000 px and below.
  Dialogs and chip editors stay open across every crossing.
- `useWorkspaceLayout` (`apps/web/components/workspace/useWorkspaceLayout.ts`) reads both media
  queries synchronously on its first render (the workspace mounts only after storage is read on the
  client), so a reload never replays a crossing, then turns media-query changes into `resize`
  events. It replaced the three reconcile effects, the four "close everything else" blocks and the
  `useIsPhone`/`useIsNarrow` hooks. The controller hands views actions (`openTrip`, `openNav`,
  `closeDrawer`, `toggleChats`, `showTrips`, `selectView`, `openFactsSheet`, `closeDialog`, …)
  instead of layout setters.
- A reload starts with every panel closed and restores the saved view; outside phone width a saved
  Trip or Mine tab restores as Chat without opening anything.
- The catalog layout no longer stores whether the Trip drawer or the preferences editor is open;
  an `open` value written by an older version is dropped when the catalog is read.
- Sidebar width and collapse, the chat share and the Trip overview/timeline tab are preferences and
  stay outside the reducer. The phone Back handler (`usePhoneBack`) is unchanged; it is now called
  from `WorkspaceView` instead of the trip-badge hook.

## Alternatives considered

- **Keep the reconcile effects and fix the Trip drawer crossing in another effect.** The smallest
  change, but it repeats the pattern behind #184: each rule lives in a caller and can only be checked
  in a browser.
- **Close every panel on a breakpoint crossing.** Simple and predictable, but the traveller loses
  what they were reading; the owner chose to keep the same thing on screen (Q8 of the #196
  interview).

## Consequences

- What is on screen after any sequence of taps and width changes is tested without a browser in
  `apps/web/tests/lib/workspace/layout.test.ts`; `phone-mine.e2e.mjs` checks the crossings in a real
  browser.
- Widening from the Trip tab now opens the Trip drawer, and widening from Mine shows Your trips: a
  visible behaviour change from the [phone shell](../feature/2026-10-05-phone-shell.md), which closed
  drawers and fell back to Chat.
- Settings opened from the navigation drawer now keeps the drawer open beneath it.
- A new panel or page must be added to `Surface` and its events, not as controller state.
- A desktop reload with a saved phone-only tab saves Chat, so the next phone visit opens on Chat.

## Sources

- Spec #196 and ticket #198 in GitHub Issues.
- [Session log](../../../session-logs/2026-10-06-workspace-layout-reducer.md)
