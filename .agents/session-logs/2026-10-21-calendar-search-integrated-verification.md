---
date: 2026-10-21
author: Codex
branch: fix/calendar-date-search-identity
pr: pending creation
area: apps/web, docs
contract-impact: none
---

# Integrated verification for calendar, identity and search fixes

## What changed

- Kept the original dated session log frozen; this addendum records post-#473 integration checks.
- Added E2E for trip switching/month reset, range clearing, cross-field AND search and compact snapshot identity.

## Why

- Latest `origin/main` includes #473; prior verification on the earlier base cannot establish the integrated tree.

## Validation

- `CHANNEL=chrome LABEL=integrated-final-0cfb4d5 pnpm --filter @trip/web e2e calendar-trip-identity-search` — passed, 18 checks; 1440px and 390px, no page errors.
- `pnpm --filter @trip/web test -- --maxWorkers=2` — passed, 57 files / 642 tests.
- `pnpm --filter @trip/web typecheck`; `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` — passed.
- Added-comment guard on four production files and E2E; `git diff --check` — passed.

## Notes for the next person

- Integrated baseline: `0cfb4d5ef6ddb2f89203772f8738bd6056660d8c`; fixtures use saved local mock data and a fixed browser clock, not live providers/auth.
- Earlier failed artifacts remain under `output/`: baseline reproduced month/identity/search bugs; later harness retries exposed fixture tripId mismatch and an open Where overlay intercepting clicks. Corrected fixture/order; final run passed.
- Original log remains unchanged; update PR evidence with the final pushed head and CI result.
