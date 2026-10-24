# Agent Note: the phone trajectory ledger uses 56 px record cards

Status: implemented
Owner: issue #686 and the phone layout of the trajectory tab (follows [phone trajectory](2026-10-24-phone-trajectory.md))

## Problem

On a 390 px phone the ledger was the desktop table squeezed into the panel. Each row was 30 px with a 76 px
kind column and a monospace request cut to one line, so the request and its result read as one crowded
string. The toolbar buttons were 36 px high and the search field 22 px with 12 px text (#686). The cause of
the 36 px height is the app's global `button` rule in `forms.css`, which gives every unlisted button a
36 px minimum, a pill background and 6px 14px padding; the copied DSH controls were never excluded from it.

## Decision

- **Phone rows are 56 px cards.** Under `data-trajectory-phone` (set by `TrajectoryView` at phone width) a
  record row is 56 px tall: a 28 px kind tile in a 44 px column, and the request on the first line with the
  result on the second. Text beyond two lines is clipped. The row height is the same constant the virtual
  list estimates (`PHONE_CONTENT_ROW_HEIGHT`), so long ledgers keep their scroll positions. Collapsed
  summary rows keep their 20 px height.
- **Toolbar controls are 44 px.** Turns and Calls are 44 px high; the search field is 44 px with 16 px text,
  so iOS does not zoom when it is focused. The toolbar wraps: search takes the first row beside the
  buttons, and the hit count with its previous and next buttons moves to the second row when a search runs.
- **The inspector's controls are 44 px.** Tabs, the close button and the Payload and Result headings have
  44 px hit areas, and their global pill backgrounds are cleared under the same selector.
- **Scope.** Only `data-trajectory-phone` changes. Desktop and tablet widths keep the table, the 30 px rows
  and the timeline overview. The global button rule itself is not changed, so other screens are unaffected.

## Alternatives considered

- **Exclude the trajectory classes from the global button rule.** It fixes the height at its source, but
  it changes the desktop ledger too, which the redesign was not asked to change.
- **Render a separate card list for the phone.** It duplicates the table's selection, folding, search and
  virtual list. A row-height change keeps all of them.
- **Show the kind as a text caption above the request.** It needs a third line per row, which pushes the
  list below the first screen at 390 px for little gain over the icon and the inspector.

## Consequences

- A phone screen shows fewer records at once, since each row is 56 px instead of 30 px; the request is readable without opening the inspector, and the full text is one tap away.
- A kind has no visible text on the phone; the icon is the only cue, and the inspector names it.
- The E2E `trajectory-phone` checks the 44 px controls, the 16 px search text and the 56 px rows in English
  and Chinese at 390 and 360 px.

## Sources

[2026-10-24 phone trajectory cards session log](../../../session-logs/2026-10-24-phone-trajectory-cards.md)
