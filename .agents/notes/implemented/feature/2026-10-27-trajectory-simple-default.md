# Agent Note: the Trajectory tab opens on a simple list and keeps the full view behind a switch

Status: implemented
Owner: spec #730, ticket #735

## Problem

The [2026-10-24 trajectory-tab decision](2026-10-24-trajectory-tab.md) made the copied DSH ledger the only
view of a chat's Trajectory: a table with a timeline overview and an inspector. That is the right tool for
a developer or a demo presenter, but a traveller who only wants to know what happened in each round has to
read a debugging table. The tab needs a readable default without losing the ledger.

## Decision

- **Two views, one model.** `TrajectoryTab` builds the ledger once with `buildTrajectory` and hands the
  same `turns` to `TrajectorySimple` and to `TrajectoryView`. The simple list adds no second data path.
  The adapter puts two optional fields on each turn: `summary` (the traveller's message on one line) and
  `result` (`working`, `done`, `failed` or `needs_change`), and a `round` number on each step group.
- **Result.** `working` while a request streams; `failed` when the turn has no reply or an assignment or
  tool call failed or was stopped; `needs_change` when the last conflict check or stop still names a
  specialist that must change (a conflict check with conflicts, or a stop for the round limit or an
  infeasible budget); otherwise `done`.
- **Simple row.** One row per turn: the message summary, the avatars of the distinct specialists that took
  part (never the Coordinator) and the result. One row is open at a time. Opening it lists its steps, in
  order, with each assignment and check and its outcome.
- **Default and switch.** The tab opens on the simple list, on desktop and on the phone, every time it is
  mounted. A two-button group, Simple and Full view (`aria-pressed`), switches in place. The open row is
  the selected turn: switching to the full view scrolls the ledger to that turn, and switching back keeps
  the row open. The mode is not stored, so closing and reopening the tab returns to the simple list.
- **Jumps.** A per-reply summary opens the tab with that turn open in whichever view is showing. A
  team-panel row filters whichever view is showing to that specialist; the "Show all records" bar is
  unchanged.
- **Empty.** With no turns the tab shows its existing empty state (the phone card, or the full view's own
  empty ledger) and no switch.
- **What stays.** The full view, its toolbar, overview and inspector, the record mapping and the
  file-size exception of the 2026-10-24 note are unchanged.

## Alternatives considered

- **Replace the ledger with the simple list.** Loses the timeline, search and inspector that the demo and
  developers rely on; out of scope for the spec.
- **A separate simple data builder.** Two builders would drift; the same-model rule in the spec rules it out.
- **Remember the last mode.** Would reopen the debugging table for a traveller who once switched; the
  default must stay the simple list.

## Consequences

- The 2026-10-24 note stays in `implemented/`: only its statement that the ledger is the tab's single view
  is replaced; its copy, mapping and tab decisions still stand, so it is cross-linked, not archived.
- Every E2E that inspects the ledger first presses Full view.
- The result rule reads only events already stored; a turn whose checks were not stored reads `done`.
