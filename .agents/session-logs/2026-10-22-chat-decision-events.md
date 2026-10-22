---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/chat-decision-events
pr: none
area: packages/shared, packages/orchestrator, apps/web
contract-impact: packages/shared
---

# Stream the planning loop's decisions to the chat

## What changed

- `packages/shared/src/chat.ts`: `ChatWorkflowDecision` and a `decision` variant of `AgentProgressEvent`.
- `packages/orchestrator/src/chat.ts`: `runTripChat` forwards `onDecision` to `onProgress`.
- `apps/web/lib/agent-lab/{event-copy,trace-overview}.ts`: handle the new variant; the Lab never emits it.
- `apps/web/tests/e2e/chat-decision-stream.e2e.mjs` and its failure inventory.
- Agent Note `2026-10-22-chat-decision-events.md`; `docs/api.md` and `docs/api.zh.md`.

## Why

Chat views, starting with the assistants spec #561, need conflicts, revision scores and stop reasons as
structured data instead of coordinator prose. Joey approved the `packages/shared` change on 2026-10-22.

## Validation

See the pull request body.

## Notes for the next person

Mock data mode reaches a repairable conflict with Sydney to Tokyo, 6 nights, budget AUD 2,800.
