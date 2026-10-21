---
date: 2026-10-19
author: Codex
branch: fix/pending-ask-failure-recovery
pr: 448
area: apps/web
contract-impact: none
---

# Keep pending questions open while an answer is submitting

## What changed

- Pass submission state from `ChatPanel` to `QuestionComposer` and disable dismiss while the request is active.
- Extend `pending-ask-refresh.e2e.mjs` to hold the answer request, assert dismiss is disabled, then verify failed submission keeps drafts and retry.
- Update the component test setup with the new required prop.

## Why

Ponytail review found that dismissing during an in-flight request removed the pending question; a later request failure could not restore the question or its drafts.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh`: passed at 375px and 1440px, 31 assertions, no browser errors; artifact `output/e2e/runner/2026-10-18T17-22-18-074Z.json` and screenshots under `output/playwright/pending-ask-refresh/2026-10-18T17-22-25-309Z/`.
- `pnpm --filter @trip/web test`: 57 files and 632 tests passed; existing jsdom canvas warnings appeared.
- `pnpm --filter @trip/web typecheck`: passed after updating the component test fixture.
- `pnpm --filter @trip/web lint`: passed without warnings or errors.
- `pnpm exec prettier --write apps/web/components/chat/ChatPanel.tsx apps/web/components/chat/QuestionComposer.tsx apps/web/tests/e2e/pending-ask-refresh.e2e.mjs`: passed.
- `pnpm exec prettier --write apps/web/tests/components/chat/QuestionComposer.test.tsx`, `pnpm format:check-changed origin/main`, and `git diff --check`: passed.

## Notes for the next person

No docs or Agent Note update is needed. Re-run the focused E2E after changes to the pending question submission lifecycle.
