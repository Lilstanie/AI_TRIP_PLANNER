---
date: 2026-10-02
author: Claude
branch: feature/agent-lab-failures
pr: none
area: packages/orchestrator, packages/shared, apps/web, docs
contract-impact: packages/shared
---

# Failure Lab: registered faults, failed artifacts you can download and replay (#105)

## What changed

- `packages/shared/src/agent-lab.ts`: `AgentLabFaultProfileId`, optional `faultProfileId` on the request, an
  artifact `faultProfileId` (default null), failure `code` `agent_failed` and `agent`, and the events
  `lab_fault_injected`, `lab_agent_output_rejected` and `lab_supervisor_fallback`. Schema version stays 1.
- `packages/orchestrator`: `fault-profiles.ts`, `faults.ts`, `runAgentLabToArtifact`; the workflow gains
  `supervisorModel` and two optional decisions. `route.ts` is built on `runAgentLabToArtifact` and rejects any
  unregistered combination.
- `apps/web`: a Failures view (`FailureLab.tsx`), `fault-outcome.ts`, `run-view.ts`; replay and download accept
  failed artifacts.
- Tests written first: `agent-lab-faults.test.ts`, route tests, `fault-outcome.test.ts` and
  `agent-lab-failures.e2e.mjs`. The replay E2E's failed-run case changed with the rule. Docs (en and zh), an
  Agent Note, and a correction to the replay note's facts.

## Why

See the Agent Note: faults are registered, never visitor-defined, and each shows what the workflow really does.
Probing every provider call against every specialist showed that only some faults degrade; the rest stop the
run, and the lab shows that as it is.

## Validation

- Tests first failed on the missing exports; breaking three fault wrappers made 3 of the 15 fault tests fail.
  Mutating the outcome classification made the E2E fail on the supervisor profile.
- Failure Lab E2E: 129 of 129 passed (all five profiles live, download of every artifact including failed ones,
  offline replay with identical cards, Run all and Cancel, keyboard, phone width). Existing E2Es: single-agent
  70, comparison 155, revision 77, replay 71, benchmarks 80.
- Servers ran with `USE_MOCK_TOOLS=true` and every key blank (temporary launch entry, not committed).
- `pnpm typecheck`, `lint`, `test` (shared 49, services 4, tools 113, agents 117, orchestrator 213, web 422),
  `test:scripts` (26), `build`, `verify:docs`, `verify:protected`, the pair check (15) and Prettier: all passed.

## Notes for the next person

- Fixture runs still do not force mock tools; #106 owns that. The fault results assume none.
- The weather test clock fix is already on `main`.
