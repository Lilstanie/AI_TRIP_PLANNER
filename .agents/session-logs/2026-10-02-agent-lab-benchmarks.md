---
date: 2026-10-02
author: Claude
branch: feature/agent-lab-benchmarks
pr: none
area: packages/orchestrator, packages/shared, apps/web, docs
contract-impact: packages/shared
---

# Benchmark scenarios: infeasible Paris budget and Tokyo-Kyoto consistency (#104)

## What changed

- `packages/shared/src/agent-lab.ts`: `AgentLabScenarioId` gains `paris-family-infeasible` and
  `tokyo-kyoto-multi-city`. Artifact `schemaVersion` stays 1.
- `packages/orchestrator/src/agent-lab/`: the two scenarios (`paris-family.ts`, `tokyo-kyoto.ts`),
  `rules.infeasibleBudget`, new evaluator checks, `AGENT_LAB_EVALUATOR_VERSION`, `cities.ts`; the
  early-start check counts activities only.
- `apps/web/lib/agent-lab`: a Conflict outcome comparison row and conflict-check and stop titles that name
  repairable, infeasible budget and the stop reason.
- Tests: `agent-lab-benchmarks.test.ts` and `agent-lab-benchmarks.e2e.mjs`, each with its failure
  inventory written first. Docs (en and zh), orchestrator README and an Agent Note.

## Why

See the Agent Note: an impossible request must not reward fabricated feasibility, and multi-city
consistency needs checks that can fail. Roadmap and the E2E script count in `development.md` are not
edited here because #119 changes the same lines; fix them when it merges.

## Validation

- Tests written first failed (unknown scenario). 39 new orchestrator tests pass; breaking three checks on
  purpose made 9 fail. Whole orchestrator suite 198, comparison tests 17.
- Benchmark E2E: 80 of 80 passed, with the move, stays, activities and totals recomputed in plain
  JavaScript. Existing single-agent, comparison and revision E2Es: 70, 155 and 77 passed.
- Servers ran with `USE_MOCK_TOOLS=true` and every key blank (temporary launch entry, not committed).
- `pnpm typecheck`, `lint`, `test` (shared 49, services 4, tools 113, agents 117, orchestrator 198, web 407),
  `test:scripts` (26), `build`, `verify:docs`, `verify:protected`, the pair check (15) and Prettier: all passed.

## Notes for the next person

- `@trip/tools` weather test broke on 2026-10-02 (unpinned clock); fixed separately on
  `fix/weather-test-pinned-clock`. CI on this branch fails until that lands.
- The evaluator reads the `infeasible budget` conflict wording and the hotel `YYYY-MM-DD to YYYY-MM-DD`
  text; see the Agent Note.
