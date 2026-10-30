---
date: 2026-10-30
author: Claude Code
branch: fix/TP-163-guide-budget-currency
pr: none
area: packages/agents
contract-impact: none
---

# The destination-guide model no longer sees the budget

## What changed

- `packages/agents/src/destination-guide/index.ts`: `read_destination_evidence` returns the brief
  without `budgetTotal` and `budgetSource`.
- New E2E `apps/web/tests/e2e/guide-budget-evidence.e2e.mjs` (with failure inventory). It starts an
  OpenAI-compatible stub and records the evidence the guide model is handed.
- `docs/architecture.md` and `.zh.md` describe the rule.

## Why

#524 (TP-163): the guide summary said "about 4,000" (the bare AUD budget) while the reply used USD.
The guide never uses the budget, so the figure is removed at the source, not reworded in the prompt.

## Validation

- `DEEPSEEK_API_KEY=stub DEEPSEEK_BASE_URL=http://127.0.0.1:3231 DATA_MODE=mock node scripts/redgreen.mjs guide-budget-evidence -- packages/agents/src/destination-guide/index.ts`:
  before 8/10 ok (the two budget checks fail), after 10/10 ok.

## Notes for the next person

The E2E needs `DEEPSEEK_BASE_URL` and `DEEPSEEK_API_KEY` set for the server (any key; the port in
the URL is where the script starts its stub), so the runner skips it otherwise. It shows what the
model receives, not what a real model writes.
