---
name: better-layout
description: Arrange content inside the apps/web workspace of AI_TRIP_PLANNER for grouping, alignment, reading order, disclosure and growth without changing the fixed workspace layout. Use when laying out or reviewing the Trip workspace, itinerary rows, Your trips and Trip home pages, drawer sections, preference fields, chat cards or map overlays.
---

# Layout

Position, spacing and alignment show hierarchy before anyone reads a word. This skill applies
**inside** the workspace's regions. The regions themselves are fixed by the
[design contract](../../../docs/design/ui-guidelines.md): the sidebar, chat and map grid, the overlay
drawers, the desktop Trip workspace, the Your trips and Trip home pages, the breakpoints and the
sidebar resizing. Follow the layout for the viewport: the
narrow-screen Chat/Map switch, or the phone shell's Chat, Map, Trip and Mine tabs at 520 px and
below. Their current behaviour is
in [workspace-ui.md](../../../docs/workspace-ui.md). A layout finding never proposes changing
those regions. If a region really does need to change, raise it as a design decision.

## Project values win

- **Spacing** uses `--space-1` to `--space-5` (4, 8, 12, 16, 24 px). The generic defaults in the
  reference files map onto these tokens: 8 px within a group is `--space-2`, 16 px or more between
  groups is `--space-4`/`--space-5`, and 12 px between bordered controls is `--space-3`. Never add a
  spacing value that is not a token.
- **Grouping** follows the contract's order. Space comes first. Then use a `--surface-2` fill. Then a
  1 px `--border` hairline. Elevation is the last resort. Do not put cards inside cards.
- **Glass floats, content stays solid.** Only floating surfaces take `glass-float`; stop cards, trip
  cards, chat bubbles and the calendar grid stay on `--surface`. Never stack glass on glass (see the
  [design contract](../../../docs/design/ui-guidelines.md)).
- **Breakpoints** are the ones in `workspace-responsive.css` and `workspace-ui.md`. Adapt a component
  to its actual container, including a narrow map-side drawer or a phone-width chat
  column. Do not add another viewport breakpoint. Prefer container queries for components that
  appear in both the chat and a drawer.

## Rules that keep coming up

- **Order by importance.** A trip row leads with the place and time, and the metadata and actions
  trail. The budget leads with the total. The one number the traveller came for is never buried. See
  [grouping-and-alignment.md](references/grouping-and-alignment.md).
- **Controls look like controls.** They have a fill, a border or a consistent control zone. A badge
  must not look like the button next to it.
- **Align to shared edges.** Use one leading edge per column and one indent step (`--space-4`) per
  level of nesting.
- **Plan for growth.** Destinations, places and hotel names come from providers and users, in
  English, Chinese or mixed. Do not set a fixed width or height on text. Let rows wrap. Clamp long
  names and keep the full text reachable. A one-word button label is the riskiest string on screen.
  See [spacing-and-adaptivity.md](references/spacing-and-adaptivity.md).
- **Never clip a critical action.** The composer send button and the active editor's Save action stay
  in stable chrome or in normal flow. They must never sit at the bottom of a pane that can scroll out
  of view.
- **Content bleeds, controls float.** The map, backgrounds and media reach the edges; text and
  controls stay inside the layout margins and safe areas. A scroller under sticky chrome sets
  `scroll-padding-block-start` so anchored and focused rows never land beneath it. See
  [spacing-and-adaptivity.md](references/spacing-and-adaptivity.md).
- **Disclosure has a cue.** Thinking rows and the phone map's day-stops sheet show what is hidden;
  list disclosure also shows how many items it holds.
- **Logical properties in new code.** The interface supports English and Chinese. New code uses
  `inline-start` and `inline-end`; do not churn existing `left`/`right` solely for this convention.

## Trip workspace, drawer and split sizing

Read `workspace-layout.css`, `workspace-drawers.css`, `trip-workspace.css` and the later overrides in
`glass.css` together. On desktop (above 1000 px), with Trip closed, the shell divides chat and map
with `--chat-share` (default 0.56, adjustable from 0.30 to 0.75 in `SplitResizer`). Opening a planned
Trip replaces that split with the Trip workspace: the itinerary and its linked map side by side
(`minmax(360px, 0.92fr)` and `minmax(0, 1.08fr)`), the chat hidden and the saved split unchanged.
The itinerary column can therefore be as narrow as 360 px; lay its rows out for that width.

At 521–1000 px Trip is one content area with an Itinerary/Map switch, and the navigation drawer
spans the content area inside its floating gaps. At ≤520 px Trip renders in the phone tab; do not
force a desktop width onto it. Keep existing breakpoints and prefer container queries for the rows
inside these regions.

## Verify

Check desktop 1440 × 1000 and phone 390 × 844 as the
[ui-verification skill](../ui-verification/SKILL.md) describes. Add 200% zoom when the change
affects text containers. There must be no sideways page scroll at phone width.
For Trip workspace changes, check a viewport just above 1000 px with the sidebar visible, where the
itinerary column is narrowest. For chat and map changes, check the default split and both 30%/75%
chat extremes. Record measured shell, column and content widths. Check long mixed-script place
names, budget totals, day controls, menus and close actions at that narrow width. Then cross
1000/1001 px and 520/521 px with Trip open to verify the responsive presentation and focus.
A fixed-container stress harness from [break](../break/SKILL.md) complements this workspace walk;
it cannot establish viewport navigation behavior.

## Reporting

Order findings by severity, one row per root cause:

| Severity | Location | Before | After | Why |
| -------- | -------- | ------ | ----- | --- |

- `HIGH`: hides content or an action at a supported width.
- `MEDIUM`: harms hierarchy, reading order or growth.
- `LOW`: isolated alignment or spacing polish.
