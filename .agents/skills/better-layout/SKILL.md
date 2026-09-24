---
name: better-layout
description: Use when arranging or reviewing content inside the apps/web workspace of AI_TRIP_PLANNER — drawer sections, trip timeline rows, preference fields, chat cards, map overlays — for grouping, alignment, reading order, disclosure and growth, without changing the fixed workspace layout.
---

# Layout

Position, spacing and alignment show hierarchy before anyone reads a word. This skill applies
**inside** the workspace's regions. The regions themselves are fixed by the
[design contract](../../../docs/design/ui-guidelines.md): the sidebar, chat and map grid, the overlay
drawers, the breakpoints, the sidebar resizing and the narrow-screen Chat/Map switch. Their current
behaviour is in [workspace-ui.md](../../../docs/workspace-ui.md). A layout finding never proposes
changing those regions. If a region really does need to change, raise it as a design decision.

## Project values win

- **Spacing** uses `--space-1` to `--space-5` (4, 8, 12, 16, 24 px). The generic defaults in the
  reference files map onto these tokens: 8 px within a group is `--space-2`, 16 px or more between
  groups is `--space-4`/`--space-5`, and 12 px between bordered controls is `--space-3`. Never add a
  spacing value that is not a token.
- **Grouping** follows the contract's order. Space comes first. Then use a `--surface-2` fill. Then a
  1 px `--border` hairline. Elevation is the last resort. Do not put cards inside cards.
- **Breakpoints** are the ones in `workspace-responsive.css` and `workspace-ui.md`. Adapt a component
  to its container, for example the drawer, which is at least 560 px wide, or a phone-width chat
  column. Do not add another viewport breakpoint. Prefer container queries for components that
  appear in both the chat and a drawer.

## Rules that keep coming up

- **Order by importance.** A trip row leads with the place and time, and the metadata and actions
  trail. The budget leads with the total. The one number the traveller came for is never buried. See
  [grouping-and-alignment.md](grouping-and-alignment.md).
- **Controls look like controls.** They have a fill, a border or a consistent control zone. A badge
  must not look like the button next to it.
- **Align to shared edges.** Use one leading edge per column and one indent step (`--space-4`) per
  level of nesting.
- **Plan for growth.** Destinations, places and hotel names come from providers and users, in
  English, Chinese or mixed. Do not set a fixed width or height on text. Let rows wrap. Clamp long
  names and keep the full text reachable. A one-word button label is the riskiest string on screen.
  See [spacing-and-adaptivity.md](spacing-and-adaptivity.md).
- **Never clip a critical action.** Review plan and the composer send button stay in stable
  chrome or in normal flow. They must never sit at the bottom of a pane that can scroll out
  of view.
- **Disclosure has a cue.** Collapsed timeline sections, thinking rows and "View all places" show
  what is hidden and how many items it holds.
- **Logical properties in new code.** The UI is English-only today, so do not churn existing
  `left`/`right` for this reason alone. New code uses `inline-start` and `inline-end`.

## Verify

Check desktop 1440 × 1000 and phone 390 × 844 as the
[ui-verification skill](../ui-verification/SKILL.md) describes. Add 200% zoom when the change
affects text containers. There must be no sideways page scroll at phone width.

## Reporting

Order findings by severity, one row per root cause:

| Severity | Location | Before | After | Why |
| -------- | -------- | ------ | ----- | --- |

- `HIGH`: hides content or an action at a supported width.
- `MEDIUM`: harms hierarchy, reading order or growth.
- `LOW`: isolated alignment or spacing polish.
