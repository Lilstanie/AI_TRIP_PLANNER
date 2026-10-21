---
date: 2026-10-21
author: Codex
branch: fix/historical-dates-confirmation-487
pr: none
area: packages/orchestrator, apps/web, docs
contract-impact: none
---

# Accept historical-date confirmation in multiline card replies

## What changed

- `packages/orchestrator/src/chat.ts` accepts a complete confirmation line within a multiline answer while retaining the matching-prompt guard.
- `apps/web/tests/e2e/planning-date-triage.e2e.mjs` covers English and Chinese card replies, unprompted confirmation, and retained dates.
- `apps/web/tests/e2e/historical-date-confirmation-browser.e2e.mjs` exercises the serialized browser card reply against the mock chat route.
- `docs/api.md` and `docs/api.zh.md` document the multiline behavior.

## Why

The UI serializes each answer as `Header: value` on a separate line. The server previously required the entire message to equal the confirmation, so it repeated the date clarification.

## Validation

- Before production changes, fixture-backed `planning-date-triage` and browser E2E reproduced the loop: multiline reply returned `ask_user` instead of `complete`.
- On integrated main `0cfb4d5e`, `USE_MOCK_TOOLS=true E2E_SCRIPT_TIMEOUT_MS=240000 pnpm --filter @trip/web e2e planning-date-triage historical-date-confirmation-browser` passed; runner: `output/e2e/runner/2026-10-21T01-47-16-042Z.json`.
- `pnpm --filter @trip/orchestrator test` passed (23 files, 275 tests); orchestrator typecheck passed.
- `pnpm --filter @trip/web test` passed (57 files, 642 tests); web typecheck and lint passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` (27 pairs), `pnpm verify:e2e-artifacts` (88 scripts), and `pnpm verify:e2e-selectors` passed.
- `pnpm exec prettier --write` on the six changed source, E2E and documentation files reported all formatted correctly.

## Notes for the next person

The E2E paths use mock fixtures and do not assert live-model behavior. A first pair check caught mismatched translated inline examples; the Chinese example was aligned and the pair check then passed.
