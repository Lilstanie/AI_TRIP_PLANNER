---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/chat-assistant-team
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Show a planning turn as a team conversation with assistant icons

## What changed

- `packages/shared/src/chat.ts`: `AssistantId`, `ChatResponse.assistant`, `agent_reasoning.assistant`, `agent_completed.source`.
- `packages/orchestrator`: the supervisor and workflow emit `source`; the coordinator reasoning carries `assistant`.
- `apps/web/components/chat`: `assistants.tsx`, `team-model.ts`, `TeamConversation.tsx`; Subagent rows use the icons.
- `apps/web/tests/e2e/assistant-team-conversation.e2e.mjs` and its failure inventory.
- Agent Note, `GLOSSARY.md` (Coordinator), `docs/workspace-ui.md`, `docs/api.md` and their `.zh.md` pairs.

## Why

Spec #561 ticket #562. Joey approved the `packages/shared/src/chat.ts` change on 2026-10-22.

## Validation

See the pull request body.

## Notes for the next person

Fixture mode never streams reasoning, so every step reads as decided by code there.
