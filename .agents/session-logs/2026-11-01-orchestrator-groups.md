---
date: 2026-11-01
author: Claude Code for Joey
branch: refactor/TP-251-orchestrator-groups
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# Group packages/orchestrator/src into brief, chat and planning (TP-251)

## What changed

- `src/brief/`: `brief`, `brief-intake`, `brief-update-fields`.
- `src/chat/`: `chat`, `chat-offline`, `chat-grounding`, `mention-handoff`, `stop-changes`, `cost-line`, `flight-answer`, `flight-query`.
- `src/planning/`: `workflow`, `supervisor`, `board`, `decisions`, `conflicts`, `budget`, `plan-totals`, `progress-copy`, `progress-tools`, `reasoning-sink`, `preference-precedence.mjs` (+ `.d.mts`).
- `index.ts`, `dates.ts`, `demo.ts`, `reply-language.ts` and `agent-lab/` stay at the root. `index.ts` exports the same names; the `./plan-totals` package export points at `src/planning/plan-totals.ts`.
- Docs, implemented notes, the agent-experience skill and tests use the new paths; `docs/development.md` (+ `.zh.md`) names the folders. The Stage 1 report source is left as submitted.

## Why

Item 5 of Joey's 2026-11-01 structure review: 27 files sat at the package root.

## Validation

- `pnpm -r typecheck` over all packages and `apps/web`: passed.
- `pnpm --filter @trip/orchestrator test`: 36 files, 422 tests passed; `pnpm --filter @trip/agents test`: 24 files, 207 tests passed.
- `node apps/web/tests/cli-e2e/selection.e2e.mjs`: passed.

## Notes for the next person

none
