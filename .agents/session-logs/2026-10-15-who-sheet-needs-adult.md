---
date: 2026-10-15
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/who-sheet-needs-adult
pr: none
area: apps/web
contract-impact: none
---

# Who sheet: a party of only children or infants is rejected

## What changed

- `apps/web/lib/workspace/trip-facts.ts`: `factErrors` returns an error on `groupSize` when the Who draft
  has children or infants and no adult or senior.
- `apps/web/lib/i18n/workspace-messages.ts`: Chinese entry for the new message.
- `apps/web/tests/e2e/who-sheet-needs-adult.e2e.mjs`: new E2E. Children-only Save keeps the sheet open
  with the error; pets-only still shows the whole-number notice; adult plus child saves and the chip reads
  "1 adult, 1 child".
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: the Who rule now names the adult requirement. The
  pair is recorded in `.agents/translation-pairs.json`.

## Why

`factErrors` checked only that `groupSize` was at least 1, so one child passed and planning ran for a
party that cannot travel (issue #368). The rule applies only when the party has children or infants, so
pets-only keeps its existing message.

## Validation

- `who-sheet-needs-adult` E2E before the fix: the children-only Save closed the sheet (checks failed).
  After the fix: 6 of 6 checks passed. Screenshot: `output/playwright/who-sheet-needs-adult/children-only.png`.
- `pnpm --filter @trip/web typecheck`: exit 0. `pnpm --filter @trip/web lint`: no warnings or errors.
- `pnpm --filter @trip/web test`: 57 files, 631 tests passed.
- `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @trip/web exec vitest run tests/lib/workspace tests/components/preferences`: 8 files, 129 tests passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:pairs` (26 pairs): pass.
- `prettier --check` on the changed docs and source files: pass.

## Notes for the next person

- Branch starts from `origin/main`, not from `fix/no-origin-no-flight` (PR #369).
- `phone-map` E2E (issue #367) was not changed. It fails before the repeated-place checks, on a
  `/api/chat` timeout. See the issue for the needs-info questions.
- `verify:e2e-selectors` printed that it "modified 3 files" that were already being edited. Those were
  this change's own files, so the diff was reviewed before committing.
