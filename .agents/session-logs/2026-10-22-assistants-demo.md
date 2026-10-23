---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/assistants-demo
pr: none
area: apps/web, docs
contract-impact: none
---

# Assistants demo walkthrough

## What changed

- `apps/web/tests/e2e/assistants-demo.e2e.mjs` and its failure inventory: the seven-step Stage 2 assistants demo at 1440 px and 390 px in English and Chinese, with a screenshot per step and a JSON record.
- `docs/demo-runbook.md` and `docs/demo-runbook.zh.md`: an "Assistants walkthrough" section.
- Agent Note consequences line.

## Why

Spec #561 ticket #567. No production code changed.

## Validation

See the pull request body.

## Notes for the next person

Step 7 clears the browser storage, so it runs last.
