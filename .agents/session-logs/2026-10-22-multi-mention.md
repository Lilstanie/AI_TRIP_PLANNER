---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/multi-mention
pr: none
area: apps/web, docs
contract-impact: none
---

# Mention several specialists in one message

## What changed

- `apps/web/tests/e2e/specialist-multi-mention.e2e.mjs` and its failure inventory.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md` describe several mentions in one message.

## Why

Spec #561 ticket #564. The orchestrator already deduplicates mentions and runs the mentioned specialists in parallel, so the ticket needed a journey that proves it and the docs.

## Validation

See the pull request body.

## Notes for the next person

No production code changed.
