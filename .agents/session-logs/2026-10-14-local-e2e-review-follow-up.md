---
date: 2026-10-14
author: Codex
branch: main
pr: none
area: apps/web, docs
contract-impact: none
---

# Restore stale-resource cleanup coverage and record remount identity policy

## What changed

- Restored E2E coverage that blocks a missing build directory recorded as retained.
- Recorded remount-safe identity matching in the implemented local E2E CLI Agent Note.

## Why

The automatic cleanup change removed the earlier stale-resource scenario. The existing implementation
already blocks it; the regression test now preserves that safety guarantee. Device-number remapping is
a lasting cleanup identity policy and belongs in the existing CLI decision note.

## Validation

- `node apps/web/tests/cli-e2e/local-cleanup.e2e.mjs` — passed; evidence at `output/e2e/local-cli-cleanup-e2e/result.json`.
- `pnpm test` — passed; all 6 package tasks succeeded, including 622 web tests.
- `pnpm verify:docs` — passed.
- `git diff --check` — passed.

## Notes for the next person

Full standards/spec review is recorded in the task response. No shared contract changed.
