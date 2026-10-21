---
date: 2026-10-19
author: Codex
branch: fix/agent-lab-multicity-validation
pr: 449
area: packages/agents, packages/orchestrator, docs, apps/web
contract-impact: none
---

# Validate transfer-day routing and multi-city benchmark evidence

## What changed

- Reject activities on transfer days when transport timing cannot establish their order.
- Align accommodation with day-one transfers by omitting cities with zero overnight nights.
- Tighten benchmark checks and update paired documentation, Agent Notes and E2E coverage.

## Why

Issue #437 showed Wollongong day activities paired with Sydney hotel nights despite no return transfer. The stay plan now begins in the arrival city.

## Validation

- Regression-first: `pnpm --filter @trip/agents test -- accommodation/index.test.ts` failed before the accommodation fix by searching Sydney for two nights; after the fix, all 21 tests in the file passed.
- `pnpm --filter @trip/agents test` — 13 files, 134 tests passed.
- `pnpm --filter @trip/orchestrator test` — 23 files, 280 tests passed.
- `pnpm turbo run typecheck --filter=@trip/agents --filter=@trip/orchestrator` — passed.
- `CHANNEL=chrome pnpm --filter @trip/web e2e multicity-triage agent-lab-benchmark agent-lab-benchmarks` — passed; all checks passed. Runner artifact: `output/e2e/runner/2026-10-18T15-31-58-710Z.json`.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm format:check-changed origin/main`, and `git diff --check` — passed.

## Notes for the next person

The review found no confirmed runtime defect. Its optional duplicated stay-evidence check is a refactoring suggestion, not a blocking finding.
