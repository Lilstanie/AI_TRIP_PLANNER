---
date: 2026-10-30
author: Claude Code
branch: fix/TP-162-edit-keeps-destination
pr: none
area: packages/orchestrator
contract-impact: none
---

# Model-free edits such as "Change it to 3 days" keep the trip's destination

## What changed

- `packages/orchestrator/src/chat-offline.ts`: the leading "<words> N days" destination pattern
  ignores captures that end in a pronoun or preposition (`it`, `to`, `by`, ...).
- New E2E `apps/web/tests/e2e/edit-keeps-destination.e2e.mjs` with its failure inventory.
- `docs/architecture.md` and `.zh.md` describe the rule.

## Why

Since #741 signed-out visitors on the deployed app use the model-free parser. Its leading-words
pattern took "Change it to" from "Change it to 3 days" as the destination (#804, TP-162). A place
name never ends in a function word, so that is the cause fixed, not a list of edit verbs.

## Validation

- `DATA_MODE=mock node scripts/redgreen.mjs edit-keeps-destination -- packages/orchestrator/src/chat-offline.ts`
  (with `PLAYWRIGHT` pointing at the container's global Playwright): before 8 PASS / 6 FAIL, after
  14 PASS / 0 FAIL.

## Notes for the next person

"Change it to 3 days and add a day trip to the Blue Mountains" still moves the whole trip to the
Blue Mountains on the model-free path: "trip to X" is read as a new destination. That needs a
day-trip concept the parser does not have.
