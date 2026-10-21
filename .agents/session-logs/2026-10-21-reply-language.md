---
date: 2026-10-21
author: Claude Code for Joey
branch: fix/chinese-progress-and-specialist-copy
pr: 507
area: packages/orchestrator, packages/agents, packages/shared
contract-impact: packages/shared
---

# Chinese progress lines and specialist summaries follow the turn's language

## What changed

- `packages/orchestrator/src/progress-copy.ts`: coordinator and supervisor progress lines in the
  interface language.
- `packages/orchestrator/src/reply-language.ts`: resolves one reply language per turn; `chat.ts`
  passes it through `workflow.ts` into `AgentContext.replyLanguage`.
- `packages/shared/src/agent.ts`: optional `AgentContext.replyLanguage` (Joey approved the shared
  contract change in the #492 thread).
- `packages/agents/src/summary-copy.ts`: the five specialists' fixed summaries in English or Chinese.
- `GLOSSARY.md`: notice covers progress lines; new reply language entry.

## Why

See the [reply language note](../notes/implemented/feature/2026-10-21-reply-language.md).
The failure inventory was written first in `packages/agents/tests/summary-copy.failures.md`.

## Validation

- `pnpm --filter @trip/agents test`: 143 passed, including `summary-copy.test.ts`.
- `pnpm --filter @trip/orchestrator test`: 283 passed, including `reply-language.test.ts`.
- `pnpm --filter @trip/shared test`: 58 passed.

## Notes for the next person

The reply model and specialist prompts do not use the resolved reply language yet; that needs a
real-model check and is the second #492 pull request.
