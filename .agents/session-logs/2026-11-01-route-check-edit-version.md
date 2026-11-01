---
date: 2026-11-01
author: Claude Code
branch: fix/TP-247-route-check-version
pr: 896
area: apps/web
contract-impact: none
---

# Background route checks no longer count as traveller edits

## What changed

- `apps/web/lib/trip/trip-edit.ts`: a `verify` preview keeps `editVersion`.
- `apps/web/tests/lib/trip/trip-edit.test.ts`: covers the kept version.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: state which edits raise the prompt.

## Why

The health check before Stage 2 found a native "Replace your edited plan?" dialog on the first chat
message after a live plan, with no edit made: the plan was at `editVersion` 12 from route checks alone.
Trips saved before this change keep their raised version and still ask once per message.

## Validation

- `pnpm --filter @trip/web exec vitest run tests/lib/trip/trip-edit.test.ts`: failed before the fix
  (expected 1 to be 0), passes after it.

## Notes for the next person

E2E scripts accept every dialog with `page.on("dialog")`, which hid this. No local E2E or build ran:
the machine has 16 GB and froze during compiles, so CI and the deployed site cover them.
