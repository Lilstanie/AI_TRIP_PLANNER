# Agent Note: the desktop trajectory stacks its inspector when the ledger is narrow

Status: implemented
Owner: TP-82 (follows [phone trajectory cards](2026-10-24-phone-trajectory-cards.md))

## Problem

On desktop the trajectory lives in the chat column, which is about 630 px wide at 1440 px beside the map.
The copied DSH layout opens the record inspector beside the ledger at `clamp(320px, 38%, 440px)`, so a
record press cut the ledger to about 300 px and the requests became a few clipped words. The toolbar
buttons, inspector tabs, Payload and Result headings and step markers were 36 px grey pills because the
global `button` rule in `forms.css` applies to every unlisted button. The timeline's 44 px label column
wrapped "Assistant" onto two lines over the Tool label.

## Decision

- **Stack the inspector under 820 px.** `TrajectoryView`'s root is the inline-size container. When it is
  820 px or narrower the table and the inspector stack: the ledger keeps the full width on top and the
  inspector fills the lower half, with its body scrolling instead of clipping the previews. Rows stay
  clickable while the inspector is open. Wider trajectories keep the side-by-side inspector and its resize
  handle.
- **Compact controls.** The toolbar buttons are 26 px with a small radius; inspector tabs, the close button,
  the overview headings and the step markers clear the global pill padding, background and minimum height.
  The phone keeps its 44 px targets because its rules come later with the same weight.
- **One-line lane labels.** The timeline label column is 64 px and the labels do not wrap.
- **The global rule stays.** `forms.css` is unchanged; only trajectory classes override it.

## Alternatives considered

- **Overlay the inspector over the ledger.** It hides the rows, so a second record needs a close first,
  and the `trajectory-tab` walk that clicks one record after another could not reach the rows.
- **Widen the chat column while the Trajectory tab is open.** It changes the workspace split the traveller
  sets, for one tab.
- **Exclude trajectory classes in `forms.css`.** It moves trajectory styling into a shared file.

## Consequences

- With an open inspector the ledger shows about eight rows at 1440 × 900 instead of the full column.
- `trajectory-tab` checks the stacked inspector, 26 px toolbar buttons and transparent inspector tabs.

## Sources

[2026-10-24 desktop trajectory layout session log](../../../session-logs/2026-10-24-desktop-trajectory-layout.md)
