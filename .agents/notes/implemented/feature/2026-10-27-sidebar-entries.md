# Agent Note: Sidebar New trip, Calendar and a Chats plus

Status: implemented
Owner: spec #730, ticket #736

## Problem

The sidebar offered only Chats and Trips. Starting a trip or opening the calendar took the Chats panel or
the Your trips page first, and the panel repeated New chat and New trip as its own buttons.

## Decision

- The desktop sidebar order is New trip, Chats with a plus, Trips, Calendar. New trip and the Chats plus
  run the existing `newTrip` and `newChat` session actions, so New trip still opens the Where editor on a
  blank trip. The plus is a sibling button of the Chats row, so Chats keeps toggling the panel.
- Calendar opens the Your trips page on its Calendar tab. The tab is lifted from `TripsPage` into
  `WorkspaceView` as an optional controlled value, so the sidebar marks Calendar or Trips current from the
  same selection the page tabs change. `PhoneMine` keeps the uncontrolled tab.
- Collapsed, every entry is an icon with a tooltip and an accessible name; the plus becomes its own
  44 px icon button named New chat. Expanded, the plus carries a `title` instead of a tooltip because the
  sidebar edge would clip it.
- The Chats panel drops its New chat and New trip buttons, which the sidebar now shows beside it; the phone
  Mine screen keeps its per-section buttons. The narrow navigation drawer has no Chats row, so it shows a
  New chat entry in its place.

## Alternatives considered

- Keep the panel buttons next to the new sidebar entries: two identical buttons for the same action in view,
  and E2E queries by name turn ambiguous.
- Open Calendar as a separate page: it would duplicate the existing calendar view.

## Consequences

`sidebar-entries` covers English and Chinese, expanded and collapsed, with screenshots and `summary.json`.
E2E scripts that clicked the panel's `.chats-panel__actions` now use `.sidebar-nav`.

## Sources

- Spec #730, ticket #736 (TP-116); the [Chats panel and Your trips note](2026-09-24-chats-panel-and-trips-page.md).
