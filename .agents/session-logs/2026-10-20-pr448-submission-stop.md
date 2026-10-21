---
date: 2026-10-20
author: Codex
branch: fix/pr448-submission-recovery
pr: 448
area: apps/web, docs
contract-impact: none
---

# Lock pending-question edits during submission and add Stop

## What changed

- Guarded question draft, navigation, submit and skip actions while an answer request is active; exposed localized Stop through the existing abort callback.
- Extended the pending-question browser E2E with failure, reload, retry, held-response cancellation, existing-plan and skip coverage.
- Updated paired workspace UI docs and retained the pre-existing failure inventory unchanged.

## Why

The question card occupies the composer while submitting, which hid its normal Stop control. A pending answer must remain available after cancellation or failure, while stale responses must not update the workspace.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh` — passed, 65 assertions, 0 browser errors across 375×812 English, 1440×1000 English and 390×844 Chinese; fixture-intercepted responses.
- Same E2E before production edits — reproduced enabled in-flight mutations and missing Stop; earlier failed runs are retained in `output/`.
- `pnpm --filter @trip/web test` — 57 files, 642 tests passed (jsdom canvas warnings).
- `pnpm --filter @trip/web build`, `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, `pnpm format:check-changed origin/main`, Prettier and `git diff --check` — passed.
- Scoped added-comment check on changed TS/JS files — no violations.

## Notes for the next person

Browser evidence uses intercepted fixtures and does not establish live model/provider or physical-device behavior. Stop aborts the active request and preserves the pending question and draft.
