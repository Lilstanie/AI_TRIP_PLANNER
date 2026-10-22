---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/mention-handoff
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Coordinator-routed hand-off for a misdirected mention

## What changed

- `packages/shared/src/chat.ts`: the `mention_handoff` workflow decision.
- `packages/orchestrator`: `mention-handoff.ts` (keyword rule and model judgement), wired into `runTripChat`; role names moved to `progress-copy.ts` so the mention dispatch line is localised.
- `apps/web/components/chat`: a hand-off message under the mentioned specialist's icon in `TeamConversation`, with a Chinese string.
- `apps/web/tests/e2e/specialist-handoff.e2e.mjs`, `packages/orchestrator/tests/mention-handoff.test.ts` and their failure inventories.
- Agent Note updated; `GLOSSARY.md` (Hand-off); `docs/workspace-ui.md`, `docs/api.md` and their `.zh.md` pairs.

## Why

Spec #561 ticket #565. Joey approved changes to `packages/shared/src/chat.ts` on 2026-10-22.

## Validation

See the pull request body.

## Notes for the next person

A hand-off applies only when exactly one specialist is mentioned. The orchestrator test covers only the live-model judgement; the browser journey covers the rule.
