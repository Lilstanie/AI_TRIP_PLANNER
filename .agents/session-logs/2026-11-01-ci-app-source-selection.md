---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-230-ci-selection
pr: pending
area: apps/web/tests/cli-e2e, docs
contract-impact: none
---

# PR CI selects one browser shard for app changes (TP-230)

## What changed

- `apps/web/tests/cli-e2e/select.mjs`: classify `real-clerk-route-inventory.e2e.mjs`; new
  `app-source` rule selects only `local-cli-collections.e2e.mjs`.
- `selection.e2e.mjs`: app source and ordinary journey paths now expect that one script.
- `docs/development(.zh).md` and a new process Agent Note.

## Why

Since #802 every PR, docs included, ran all 15 CLI scripts (~7 minutes) because of inventory drift.

## Validation

- `node apps/web/tests/cli-e2e/selection.e2e.mjs`, `runner-plan.e2e.mjs`, `ci-integration.e2e.mjs`: passed.
- Replayed `select.mjs` on PR heads: #875 #877 #879 now `selected` (local-cli-collections only);
  #874 and #878 stay `full` (they touch runner files); a docs-only commit now `skip` (was `full`).

## Notes for the next person

- No workflow file changed. Concurrency cancel and a Playwright cache need a protected-file PR.
