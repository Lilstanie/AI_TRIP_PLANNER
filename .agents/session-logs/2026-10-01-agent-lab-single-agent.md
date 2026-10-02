---
date: 2026-10-01
author: Codex
branch: feature/agent-lab-single-agent
pr: none
area: apps/web, packages/orchestrator, packages/shared, docs
contract-impact: packages/shared
---

# Add the public single-agent Agent Lab baseline

## What changed

- Added strict Agent Lab request, event, metric and artifact contracts in
  `packages/shared/src/agent-lab.ts`.
- Added the fixed Tokyo fixture strategy and streaming runner under
  `packages/orchestrator/src/agent-lab/`.
- Added public `/agent-lab`, its NDJSON API route and a responsive trace, plan and metrics inspector.
- Added one browser E2E seam with a pre-code failure inventory and repeatable artifacts under the
  ignored `output/playwright/agent-lab-single-agent/` directory.
- Documented the API, runtime boundary, UI, roadmap and decision in paired English/Chinese docs.

## Why

The first lab slice isolates strategy behavior from authentication, workspace state and provider
availability. The baseline is a strategy above the five specialists, not a sixth specialist, so
later comparison work can reuse the artifact and UI boundary.

## Validation

- Agent Lab E2E: passed on 1440 × 1000 desktop and 390 × 844 phone, including cancellation,
  strict-request rejection, keyboard order, storage isolation, artifact consistency and overflow.
- Manual browser evidence: light and dark desktop, 390 px phone, and 320 px dark/reduced-motion.
- `pnpm lint`: passed with no ESLint warnings or errors.
- `pnpm typecheck`: 6 packages passed.
- `pnpm test`: 770 tests passed across 72 files; existing jsdom canvas diagnostics remained noisy.
- `pnpm build`: passed; `/agent-lab` and `/api/agent-lab/runs` were included in the route manifest.
- `pnpm verify:docs`, `pnpm verify:protected`, translation pair checker and `git diff --check`: passed.

## Notes for the next person

This slice intentionally supports only `tokyo-couple`, `single-agent-baseline` and fixture mode.
Resume wording remains only in `.agents/local/agent-lab-resume.md` and is not part of this change.
