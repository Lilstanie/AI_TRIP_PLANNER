---
date: 2026-10-07
author: Claude
branch: fix/e2e-exit-and-phone-budget
pr: none
area: apps/web/tests/e2e, docs
contract-impact: none
---

# plan-quality fails its run on a failed check, and source-budget's phone pass runs on dev

## What changed

- `apps/web/tests/e2e/plan-quality.e2e.mjs`: sets `process.exitCode = 1` when any scenario has a
  failed check or a planning error (#208).
- `apps/web/tests/e2e/source-budget.e2e.mjs`: hides the Next.js dev-tools button on every load, so
  the 390 px pass can tap the Chat tab under a dev server (#209).
- `docs/development.md` and its Chinese pair: `plan-quality` exits non-zero on a failed check.

## Why

#209 named the removed `Open navigation` button; main had already moved the phone pass onto the phone
shell. What still failed was a tap on the Chat tab: the dev-tools button sits on top of it.
`addInitScript` is used instead of `addStyleTag` because the script reloads the page.

## Validation

- #208 before the fix, against a stub server replaying a recorded mock stream: failed checks exit 0,
  planning error exits 0. After: 1, 1, and a passing replay exits 0.
- `DATA_MODE=mock pnpm --filter @trip/web e2e plan-quality` without a model key: 0/1 scenarios
  passed and the runner now reports FAIL (it reported ok before).
- `DATA_MODE=mock pnpm --filter @trip/web e2e source-budget`: 22/22 checks (11 at 1440, 11 at 390),
  exit 0. It failed at the 390 px Chat tab before the change.

## Notes for the next person

`plan-quality` cannot pass without a model key, because three checks require model-written sections.
