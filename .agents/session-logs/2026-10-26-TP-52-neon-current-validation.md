---
date: 2026-10-26
author: Codex
branch: detached at 9edc60a9
pr: 508
area: apps/web/lib/account, apps/web/lib/db, apps/web/tests/e2e, docs
contract-impact: none
---

# Validate the memory transaction repair on the current PR

## What changed

- Applied the separately tested Neon driver repair to PR head `9edc60a9e01c52ad1c7b4e1565723fc4b71c952a`, preserving the teammate's main integration.
- Memory writes use a dedicated per-operation Neon Client transaction; HTTP reads, the existing parser, locks and undo predicates remain unchanged.
- Added a no-network actual-driver regression and updated existing fixture boundaries, paired docs and the decision note.

## Why

- The production `neon-http` transaction entry throws before invoking the write callback. PGlite-only fixtures did not expose that mismatch.
- The new probe retains real Neon/Drizzle implementations and replaces only network transport with in-process PostgreSQL wire/HTTP fixtures.

## Validation

- Node 24.20.0, Corepack pnpm 9.15.0, Playwright 1.56.1 and Chromium 141.0.7390.37; isolated workspace, no copied credentials.
- Before repair on `a7f4688`, the new driver probe failed with `No transactions support in neon-http driver`; its failure artifacts remain in the implementation workspace.
- On current PR plus repair, `LABEL=current-pr-9edc60a9 node apps/web/tests/e2e/neon-memory-driver.e2e.mjs`: 23 checks passed; all 19 sockets closed.
- `corepack pnpm build`, `corepack pnpm typecheck`, `corepack pnpm lint`: passed. Existing React-hook lint warnings remain.
- `corepack pnpm test`: all six packages passed, 122 files / 1,443 tests; `corepack pnpm test:scripts`: 70 passed, none skipped.
- `corepack pnpm --filter @trip/web e2e accommodation-memory long-term-memory memory-settings`: all three passed, including fixture concurrency, undo, precedence and account-boundary checks.
- Browser receipt: `output/e2e/runner/2026-10-25T13-47-54-145Z.json`; driver receipt: `output/e2e/neon-memory-driver/current-pr-9edc60a9/summary.json`.
- `corepack pnpm verify:docs`, translation pairs against HEAD (28), E2E selectors and artifacts (156 scripts): passed.
- Scoped added-comment check over six code/test files: no violations.
- Initial offline dependency install lacked cached packages; a frozen, install-scripts-disabled network installation succeeded.
- An early driver test used the wrong synthetic HTTP hostname; its failure was retained and the fixture corrected. This did not change production behavior.

## Notes for the next person

- Separate independent review on the implementation tree also passed 23 driver checks and confirmed no actionable production defect.
- The wire fixture is sequential. Existing PGlite acceptance covers concurrent updates; neither establishes independent live Neon-session concurrency.
- Real Neon connectivity, current Clerk accounts and cloud migration 0002 remain unverified and require separate authorization.
- No source commit, push, PR/Jira update, remote merge or external database operation was performed for this repair.
