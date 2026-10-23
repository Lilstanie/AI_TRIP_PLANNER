---
date: 2026-10-21
author: Claude Code for Joey
branch: fix/reply-language-for-models
pr: none
area: packages/orchestrator, packages/agents
contract-impact: none
---

# Models write in the turn's resolved reply language

## What changed

- `packages/agents/src/prompts/reply-language.ts`: `replyLanguageRule()` names the language and
  keeps names, ids and amounts untranslated; exported from `@trip/agents`.
- Coordinator (`chat.ts`) uses it with the resolved reply language instead of its free-form
  "detect the language" rule; the planning supervisor and the guide, dining, itinerary and
  accommodation models append it from `AgentContext.replyLanguage`.
- `reply-language.ts`: two Latin words or fewer count as unclear, so "Tokyo" typed in the Chinese
  interface gets a Chinese reply.
- Agent Note and architecture docs (en/zh) updated.

## Validation

See the pull request body for the commands run. Failure inventory:
`packages/agents/tests/reply-language-prompts.failures.md`.

## Notes for the next person

Model output can only be checked against a live model; the sandbox has none. Transport selects
only ids and gets no rule.
