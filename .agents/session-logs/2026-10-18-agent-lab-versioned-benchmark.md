---
date: 2026-10-18
author: Codex
branch: feature/agent-lab-versioned-benchmark
pr: none
area: apps/web, packages/orchestrator, packages/shared, docs
contract-impact: packages/shared
---

# Add a versioned Agent Lab benchmark and fixture report

## What changed

- Added the versioned benchmark registry endpoint and scenario metadata for 12 fixture scenarios.
- Added a report-producing browser E2E for 36 scenario-strategy runs and five registered fault experiments, with retained replay evidence.
- Documented fixture/live boundaries and added English and Chinese release smoke record templates.
- Added an Agent Note for the shared scenario IDs, report semantics and versioning decision.

## Why

Reports now derive from runner artifacts, retain failed and stopped runs in denominators, and distinguish completed plans with failed checks from safe stops.

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= pnpm --filter @trip/web e2e agent-lab-benchmark` — passed; 41 artifacts, report and replay screenshot retained.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/orchestrator typecheck` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` — passed.
- `pnpm exec prettier --check` on changed and untracked files — passed.
- `git diff --check` — passed.

## Notes for the next person

Fixture results measure deterministic scenarios and recorded runtime behavior, not live provider quality or subjective trip quality. Expected-versus-observed mismatches remain visible in the report.
