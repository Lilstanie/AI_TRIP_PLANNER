---
date: 2026-10-16
author: Claude Opus 5.5
branch: fix/grouped-money-text
pr: pending
area: packages/shared, packages/orchestrator tests, apps/web tests, .agents/notes
contract-impact: packages/shared
---

# Group AUD thousands in generated text (issue #395)

## What changed

- `packages/shared/src/money.ts`: `formatMoney` groups AUD thousands in the `cents` and `plain` styles; AUD `cents` shares the `toLocaleString("en-AU")` path of the other currencies.
- Tests that asserted ungrouped AUD strings now expect grouped ones: `packages/shared/tests/money.test.ts`, `packages/orchestrator/tests/budget.test.ts`, `agent-lab-revision.test.ts` and `agent-lab-benchmarks.test.ts` (whose own amount regex now accepts commas).
- `apps/web/tests/e2e/chat-money-format.e2e.mjs`: new E2E comparing the chat reply with the Trip panel.
- New [grouped AUD note](../notes/implemented/architecture/2026-10-16-grouped-aud-in-generated-text.md); the display-currency and one-formatter notes link to it and their AUD facts are corrected.

## Why

Decided with the owner on #395. The amounts come from the shared formatter, not the model, so the formatter is the one place to change.

## Validation

- `node tests/e2e/run.mjs chat-money-format` without the change: 2/3, the reply wrote `AUD 2000`.
- Same command with the change: 3/3.
- `pnpm --filter @trip/shared test`: 58 passed. `@trip/orchestrator`: 249 passed. `@trip/agents`: 126 passed. `@trip/web`: 632 passed.
- `pnpm typecheck`, `pnpm lint`, `pnpm verify:protected`, `verify:docs`, `verify:e2e-artifacts`, `verify:e2e-selectors`: see the PR body.

## Notes for the next person

- Code that reads an amount out of generated text must accept commas.
