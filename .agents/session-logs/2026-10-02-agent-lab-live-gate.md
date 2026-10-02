---
date: 2026-10-02
author: Claude
branch: feature/agent-lab-live-gate
pr: none
area: packages/agents, packages/orchestrator, packages/shared, apps/web, docs
contract-impact: packages/shared
---

# Gate optional live runs with public safeguards (#106)

## What changed

- `packages/shared/src/agent-lab.ts`: `AgentLabDataMode` gains `live`, `metrics.usage` gains a `measured` variant,
  and the stream gains a `rejected` frame with a reason. Schema version stays 1.
- `packages/agents/src/models.ts`: `runWithModelsDisabled` and a usage collector captured when a routed model is built.
- `packages/orchestrator`: `runAgentLab` isolates fixture runs (mock tools, no model) and meters live ones;
  `live` flag per strategy; `buildAgentLabUsage`; the multi-agent trace drops `agent_reasoning`.
- `apps/web`: `live-gate.ts` (configuration and limiter), the route's three refusals, `AgentLabRejectedError`, a Data
  mode control, a rejection notice, Fixture/Live labels, measured-usage display.
- Tests written first: `models.test.ts`, `agent-lab-live.test.ts`, `live-gate.test.ts`, route and stream tests, and
  `agent-lab-live-gate.e2e.mjs`. Docs (en and zh), an Agent Note, READMEs.

## Why

A public fixture demo only avoided the network by luck of an empty environment, and nothing gated a live path. See
the Agent Note for the isolation, the gate, the honest usage and the decision not to build a live baseline.

## Validation

- Tests first failed on the missing exports. Removing the fixture isolation made the isolation tests fail; the
  E2E found its own mistake in how it read an `<option>`.
- Live gate E2E: 55 of 55 passed against three servers (live not enabled in a hostile environment, hourly limit 0,
  concurrency 0). Existing Agent Lab E2Es passed in that hostile environment: single-agent 72, comparison 155,
  revision 77, replay 71, benchmarks 80. Two of them changed for the new Data mode control (Tab order, unknown mode).
- `pnpm typecheck`, `lint`, `test` (shared 49, services 4, tools 113, agents 124, orchestrator 208, web 433),
  `test:scripts` (26), `build`, `verify:docs`, `verify:protected`, the pair check (15) and Prettier on the changed files:
  all passed.

## Notes for the next person

- A real live run (keys, usage from a provider) was not exercised: there are no credentials here. Refusals, limits and
  fixture isolation are.
- The limits are per server process. The scripted baseline has no live implementation.
- `.env.example` is protected and not changed; the new settings are in `docs/development.md`.
