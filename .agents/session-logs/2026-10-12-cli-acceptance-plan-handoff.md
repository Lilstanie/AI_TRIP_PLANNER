---
date: 2026-10-12
author: Codex
branch: feature/cli-acceptance-ci
pr: 318
area: testing
contract-impact: none
---

# Start the CLI acceptance selection integration

## What changed

- Published spec #314 and tickets #315, #316 and #317 with native dependency edges.
- Opened integration branch `feature/cli-acceptance-ci` and Draft PR #318 after the
  first completed implementation merge; resume this branch and PR for ticket #315.
- Integrated #316's validated shard runner at merge `59c2e8b` from `eb0a652`.
- Ticket #315 remains in progress; #317 integrates both completed implementations.

## Why

Documentation-only PR #313 waited 14m43s for CLI acceptance. Recorded GitHub steps
spent 2m35s installing Chromium and 11m43s in sequential acceptance.

## Validation

- #316 implementer reported six command-level E2E groups red before green, then
  six passing together on Node 26/macOS; source is unchanged by integration.
- Scoped added-comment check over the three runner files passed with no violations.
- `pnpm verify:docs`, `pnpm verify:protected` and
  `pnpm format:check-changed origin/main` passed on the integrated runner commit.

## Notes for the next person

The user confirmed subprocess E2E seams, ticket dependencies and protected workflow
scope. Final CI, documentation and two-axis review are pending. Stop before merge.
Original main worktree changes are excluded and preserved in their own checkout.
