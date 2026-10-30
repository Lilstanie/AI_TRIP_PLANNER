# Agent Note: the Trajectory ledger and Agent Lab styles are split below the 1,000-line rule

Status: implemented
Owner: C (@HeadmasterEggy), TP-167

## Problem

`docs/development.md` caps production source files at 1,000 lines. Three files on `main` broke it:
`apps/web/components/trajectory/TrajectoryTable.tsx` (1,555 lines), its
`TrajectoryTable.module.css` (1,341 lines) and `apps/web/app/styles/agent-lab.css` (1,145 lines). The
[Trajectory tab note](../feature/2026-10-24-trajectory-tab.md) had granted the first two an exception
so that the DeepSeek Harness (DSH) copy stayed verbatim. Joey asked on 2026-10-30 for every file over
the limit to be split.

## Decision

- **Trajectory ledger, by responsibility.** `TrajectoryTable.tsx` keeps the ledger rows, virtualisation,
  selection and scrolling. `TrajectoryInspector.tsx` renders the resizable details aside, its tabs and
  payload views; the caller keeps the width state, so the inspector reopens at the width it closed at.
  `trajectory-table-records.ts` holds the pure record logic (flattening, search filtering, turn and
  assistant folds, step keys, detail tabs, display text) and the `TrajectoryStep` type.
  `trajectory-kind.tsx` holds the per-kind label, icon and tag class shared by the ledger and the
  inspector. Each copied file keeps the DSH MIT header.
- **Ledger styles.** `TrajectoryTable.module.css` keeps the ledger rules; `TrajectoryInspector.module.css`
  takes the details aside, overview, payload and Markdown rules, including their responsive and phone
  overrides. No element takes classes from both modules except the kind tag in the inspector header,
  whose rules all stay in the ledger module.
- **Agent Lab styles.** `agent-lab.css` is an ordered list of `@import`s: `agent-lab-shell.css`,
  `agent-lab-trace.css`, `agent-lab-results.css`, `agent-lab-compare.css` and `agent-lab-faults.css`.
  Their concatenation is the old file byte for byte, so the cascade is unchanged.

## Alternatives considered

- **Keep the exception.** A verbatim copy lets a DSH update land as a plain diff; rejected because the
  team rule applies to every file and the ledger is now maintained here, not re-copied.

## Consequences

- Every file under `apps/web` that is not generated stays at or below 1,000 lines once PR #782 lands
  (it shrinks `SettingsDialog.tsx` and `Workspace.test.tsx` below the limit).
- Pulling a later DSH ledger change now means merging it by hand across four files.
- E2E scripts select by `data-*` attributes and roles, so the moved CSS-module classes need no script
  changes.

## Sources

- [Trajectory tab note](../feature/2026-10-24-trajectory-tab.md), whose file-size exception this replaces.
- [File size and style boundaries](../../../../docs/development.md#file-size-and-style-boundaries).
