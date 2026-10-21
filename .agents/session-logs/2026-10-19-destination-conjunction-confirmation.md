---
date: 2026-10-19
author: Codex
branch: fix/multi-city-destination-splitting
pr: 446
area: packages/orchestrator, apps/web/tests/e2e, docs
contract-impact: api
---

# Confirm destination conjunctions before offline planning

## What changed

- Removed the shared string splitter from model results; offline extraction normalises only explicit separators.
- Reused destination questions for ambiguous `and`, preserving known fields and the existing plan.
- Added API/browser regression evidence, updated multi-city acceptance and both API references.
- Recorded the boundary in the destination conjunction Agent Note.

## Validation

- Initial regression failed: Trinidad and Tobago completed without confirmation; runner `2026-10-19T11-56-19-927Z.json`.
- Intermediate failures exposed answer-label parsing and a browser wait that observed the question instead of completion.
- `CHANNEL=chrome LABEL=verified pnpm --filter @trip/web e2e destination-conjunction destination-conjunction-browser multicity-triage`: all three passed; API 4s, browser 75s, multi-city 49s.
- Runner `output/e2e/runner/2026-10-19T12-02-37-142Z.json`; browser screenshots/results under `output/playwright/destination-conjunction/`.
- `LABEL=final pnpm --filter @trip/web e2e destination-conjunction`: passed 9s, including Chinese confirmation and changed fields while revising an existing plan; runner `2026-10-19T12-04-18-945Z.json`.
- `pnpm --filter @trip/orchestrator test`: 275 passed across 23 files.
- `pnpm turbo run typecheck --filter=...@trip/orchestrator`: 2 tasks passed.
- `pnpm --filter @trip/orchestrator lint`: passed.
- `pnpm --filter @trip/web test`: 632 passed across 57 files; `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-artifacts`, `pnpm verify:e2e-selectors`: passed; 79 scripts write artifacts.
- Runtime: Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.82; anonymous mock mode, desktop 1440×1000 and phone 390×844, four browser cases, no page errors or horizontal page overflow.

## Notes for the next person

Model-service extraction and physical devices were not exercised. Model output is accepted directly;
API coverage includes a structured known complete place name. The initial dependency install used
`pnpm install --frozen-lockfile`; no lockfile changed. Evidence is quoted in PR #446 before cleanup.
