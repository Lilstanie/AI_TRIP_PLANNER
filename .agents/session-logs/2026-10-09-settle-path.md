---
date: 2026-10-09
author: Claude Code (ticket #263 refactor run)
branch: refactor/settle-path
pr: 258
area: apps/web (settle, estimate), docs, .agents
contract-impact: none
---

# One settle path for every plan change (#263, spec #259)

## What changed

- `apps/web/lib/trip/settle.ts`: a section's estimate sums its scheduled items. An activity with no day (an Idea) does
  not count toward the estimate or the budget total. This one rule is the shared settle for the server's operations
  and the browser's details, note and booked edits.
- `apps/web/tests/e2e/settle-path.e2e.mjs` (new): seven scenarios on moving, removing, moving to Ideas, scheduling an
  Idea back, and the Your trips card against the drawer. Red at 720a123 (D and E failed); green after the change.
- `docs/workspace-ui.md` and its `.zh.md` pair: Ideas' prices are outside the estimate.
- Agent Note `implemented/feature/2026-10-09-settle-path.md` (promoted from proposed).

## Why

Spec #259, ticket #263: the client does not compute totals, and every plan change settles the same way. Moving a
priced stop to Ideas left the total unchanged because the Idea's price stayed in the sum.

## Validation

Run on the final branch (see the commit message and the PR for the exit codes):

- `npx tsc --noEmit` in apps/web, `pnpm --filter @trip/web lint`, `pnpm --filter @trip/web test` (581 tests), build.
- `node scripts/verify-docs.mjs`, `check-pairs.mjs` (24 pairs), `verify-protected-files.mjs origin/main`.
- `DATA_MODE=mock pnpm --filter @trip/web e2e settle-path timeline itinerary auto-save-places choose-fare-and-stay plan-revision notice-keys drawer-walkthrough workspace-chinese check-entry-point`.

## Known limitations

- The map shows no budget total in this codebase, so the map half of criterion 3 has nothing to match.
- The live (Google) path is not exercised.

## Notes for the next person

- Agent Note status: `implemented` for #263. The four tickets of spec #259 are now merged.
