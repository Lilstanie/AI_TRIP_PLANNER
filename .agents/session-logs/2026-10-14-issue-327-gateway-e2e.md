---
date: 2026-10-14
author: Codex
branch: fix/issues-323-330
pr: none
area: packages/tools, packages/orchestrator
contract-impact: none
---

# Move missing-date weather checks to gateway E2E

## What changed

- Extended ToolGateway provider-matrix evidence for exact forecast dates, historical wording, and both providers omitting the requested date.
- Added a complete planning-run E2E proving failed weather evidence yields truthful monthly context in the destination guide.
- Removed the newly added direct WeatherPort missing-date tests; existing unit coverage stays at its prior boundary.

## Why

The regression should be verified through the approved ToolGateway and browser/planning acceptance seams, with an artifact that records the complete planner outcome.

## Validation

- `pnpm --filter @trip/orchestrator exec vitest run tests/weather-provider-planning.e2e.test.ts` — passed (2 tests).
- `pnpm --filter @trip/tools exec vitest run tests/provider-matrix.e2e.test.ts` — passed (15 tests).
- `pnpm --filter @trip/tools test` — passed (140 tests).
- `pnpm --filter @trip/orchestrator test` — passed (244 tests).

## Notes for the next person

- `docs/` and Agent Notes need no additional update; the existing superseding #327 note records the behavior decision. Branch-wide acceptance gaps for #323, #328, #329 and #330 remain outside this follow-up.
