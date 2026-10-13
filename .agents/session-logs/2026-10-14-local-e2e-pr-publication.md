---
date: 2026-10-14
author: Codex
branch: fix/local-e2e-auto-cleanup
pr: none
area: docs, workflow
contract-impact: none
---

# Prepare local E2E cleanup for pull request

## What changed

- Recorded the reviewed English and Chinese local CLI documentation hashes.
- Created the dedicated fix branch for the existing cleanup implementation.

## Why

The pre-push translation check found a stale review record. Both documentation changes describe the same automatic cleanup, evidence retention and remount identity conditions.

## Validation

- `pnpm verify:docs` and `pnpm verify:protected` — passed.
- `pnpm --filter @trip/web lint` — passed.
- Initial `pnpm verify:pairs` — failed on the stale local CLI record; reviewed both language diffs and updated that record.

## Notes for the next person

Application code and E2E fixtures are unchanged from the already-tested implementation commit. Unrelated working-tree files remain outside this PR.
