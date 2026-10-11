---
date: 2026-10-11
author: Codex
branch: docs/review-skill-names
pr: none
area: .agents/skills, apps/web/tests/cli-e2e, docs
contract-impact: none
---

# Implement the task-scoped review gates from the retrospective

## What changed

- Add the explicit-base/file added-comment CLI under review-trip-planner, using installed TypeScript parsing.
- Add public CLI acceptance with retained temporary Git fixtures and JSON reports.
- Wire task requirements, comparison/head SHAs, untracked scope and evidence into review and pre-push guidance.
- Update bilingual development navigation and record the process decision.

## Why

The initial review missed the original task's comment prohibition. A mechanical gate covers that
constraint while the handoff preserves requirements and independent review status.

## Validation

- Failure inventory and CLI journey preceded implementation; the initial missing command failed.
- Inline retained-comment and duplicate-comment scenarios failed before their fixes, then passed.
- Final CLI journey passed 21 cases; evidence: output/e2e/review-comment-policy/2026-10-11T06-56-38.912Z/summary.json.
- pnpm test passed all six package tasks (five cached); web: 52 files / 622 tests passed.
- pnpm typecheck and pnpm lint passed all six tasks each (five cached).
- pnpm test:scripts passed 35 tests; pnpm verify:docs passed.
- Working-tree verify:pairs failed on the pre-existing docs/design/ui-guidelines.md review hash.

## Notes for the next person

- The new gate and its acceptance journey are local workflow commands, not registered CI jobs.
- No protected root configuration, frozen history, global skill or application runtime code changed.
- Independent review could not start: the same required reviewer returned agent not found; no replacement spawned.
- Unrelated Android, UI-guidelines, older logs, proposed CLI note and scratch/output/tmp files remain untouched.
