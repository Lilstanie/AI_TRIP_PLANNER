---
date: 2026-10-01
author: Claude
branch: feature/agent-lab-three-way-comparison
pr: none
area: apps/web, docs
contract-impact: none
---

# Compare all three Agent Lab strategies on the page

## What changed

- Compare all strategies runs the three strategies in turn; the comparison table, plans and traces
  show all three, with fourteen measured rows (`lib/agent-lab/comparison.ts`).
- Revision runs show the conflict, the revised specialist, the previous outcome, the score and the
  stop in the inspector; later rounds say `round N` in their titles. Lists get visible headings.
- The metrics panel shows grounding, repeated and generic stops, stopping reason and token and model
  cost, which reads "Unavailable", never 0.
- The page explains which pair measures specialization and which the repair loop, and that five
  specialists is not a target. Changing the scenario clears the previous scenario's results.
- Updated the workspace UI and roadmap pages in both languages.

## Why

A result belongs to the scenario that produced it, and a comparison that can drop or reorder a
strategy would misattribute figures, so rows are built from each run's artifact in registry order.

## Validation

- Failure inventory and failing tests before `comparison.ts`: three columns, usage as a number, a
  missing stop reason, single-city multi-city, a cancelled run labelled "Not run".
- Browser E2E evidence for this page lands in the next change.

## Notes for the next person

Until that change the older comparison E2E still expects two strategies.
