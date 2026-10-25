---
date: 2026-10-25
author: Codex
branch: fix/TP-89-planning-readiness
pr: none
area: packages/orchestrator, packages/shared, apps/web/tests, docs
contract-impact: packages/shared
---

# TP-89 unifies brief intake before planning

## What changed

- Added `brief-intake.ts`; plan mode, model tools and offline extraction share normalization and readiness.
- Added optional server-owned historical confirmation metadata to `ChatTurn`; old turns remain readable.
- Preserved selected-place local dates, explicit facts, learned preferences and existing-plan edits.
- Added a 70-scenario public-entry matrix and a 21-check HTTP journey, with failure inventories.
- Updated both architecture documents and the [decision](../notes/implemented/architecture/2026-10-25-brief-intake.md).

## Validation

- `DATA_MODE=mock node scripts/redgreen.mjs planning-readiness -- packages/orchestrator/src/chat.ts packages/orchestrator/src/brief-intake.ts packages/shared/src/contracts.ts`: origin/main 19/21, final 21/21.
- `DATA_MODE=mock pnpm --filter @trip/web e2e planning-date-triage`: passed.
- `pnpm --filter @trip/orchestrator test`: 32 files, 385 tests passed, including 70 intake scenarios.
- `pnpm --filter @trip/shared test`: 4 files, 58 tests passed.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed; jsdom canvas warning retained in runner log.
- `pnpm typecheck`: all 6 tasks passed.
- `pnpm --filter @trip/shared --filter @trip/orchestrator lint`: passed after removing an unused import.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`: passed.
- Artifacts: `output/e2e/brief-intake/matrix.json`, HTTP NDJSON and `checks.json` under `output/e2e/planning-readiness/`.
- First 30-scenario baseline: 14 failed; expanded matrix initially had a shared mock-call counter, corrected before final regression evidence.
- Combined destination/date flow reproduced 2 failures before the final fix; all 21 HTTP checks now pass.

## Notes for the next person

Mock tools and scripted models verify orchestration, not live providers. Legacy text-only historical
questions ask once again. No database migration or browser snapshot change is needed. #2 remains
in its separate PR #702. Merge and branch deletion require the user's explicit instruction.
