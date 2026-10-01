---
date: 2026-10-01
author: Claude
branch: feature/agent-lab-single-agent
pr: none
area: apps/web, packages/orchestrator, packages/shared, docs
contract-impact: packages/shared
---

# Fix the Agent Lab review findings

## What changed

- The metrics panel now reads `metrics.withinBudget` and `budgetHeadroom`, so an overrun shows as over
  budget with the amount instead of a fixed "Within budget".
- The evaluator moved to `packages/orchestrator/src/agent-lab/evaluate.ts` and measures the scenario's
  own rules (sections, budget, conflicts, destination, earliest start, vegetarian-marked meals). The
  contract replaced `constraintsSatisfied`/`constraintsTotal` with `metrics.checks`, and the inspector
  lists each check as Passed or Failed.
- The public-route matcher moved to `apps/web/lib/auth/public-routes.ts` so the sign-in gate can be
  tested without Clerk keys.
- The stream reader moved to `apps/web/lib/agent-lab/stream.ts`. It keeps the failed artifact from an
  `error` frame and reports malformed lines in plain words; the page shows where a failed run stopped.
- The E2E now rejects each invalid request field on its own and checks the listed checks.

## Why

A code review of the first slice found a hard-coded budget label, an evaluator that did not check the
constraints the strategy stated, and a sign-in-gate criterion that no test could observe.

## Validation

- Failure inventories and failing tests were written before the code for the route matcher, stream
  reader, evaluator and endpoint (cancel, per-field rejection). Removing the `/agent-lab` matcher entry
  or the cancel guards makes those tests fail.
- Agent Lab E2E: passed on desktop and phone; evidence refreshed under
  `output/playwright/agent-lab-single-agent/`.

## Notes for the next person

The `metrics` shape changed before any release, so the artifact `schemaVersion` stays 1. Vegetarian is
measured as "each meal is marked vegetarian-friendly" because plans carry no dietary data beyond their
wording.
