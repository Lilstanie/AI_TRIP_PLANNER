---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/mention-specialist
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Mention one specialist to change its section

## What changed

- `packages/shared/src/chat.ts`: `ChatRequest.mentions` and `ChatNeedsInfo.assistant`.
- `packages/orchestrator`: `OrchestratorOptions.mention` (dispatch reuses the plan and runs only the mentioned specialists); `runTripChat` handles mentions with and without a plan.
- `apps/web/components/chat`: `AssistantChips`, `mentions.ts`, conflict-check rule messages in `TeamConversation`; the request carries resolved ids.
- `apps/web/tests/e2e/specialist-mention.e2e.mjs` and its failure inventory.
- Agent Note updated; `GLOSSARY.md` (Mention); `docs/workspace-ui.md`, `docs/api.md` and their `.zh.md` pairs.

## Why

Spec #561 ticket #563. Joey approved the `packages/shared/src/chat.ts` change on 2026-10-22.

## Validation

See the pull request body.

## Notes for the next person

With no model the no-plan answer is a fixed sentence; with a model it is one short model call.
