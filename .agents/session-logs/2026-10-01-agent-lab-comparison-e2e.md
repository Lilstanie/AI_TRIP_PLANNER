---
date: 2026-10-01
author: Claude
branch: feature/agent-lab-comparison-e2e
pr: none
area: apps/web
contract-impact: none
---

# Add the browser E2E evidence for the three-strategy Agent Lab comparison

## What changed

- `agent-lab-revision.e2e.mjs`: on the tight-budget scenario, compares all three strategies and checks
  the conflict, the revised specialist, the previous outcome, the score, the round and the stop in the
  stream and on the page. It recomputes every stored metric from each artifact's plan and trace in
  plain JavaScript and checks it against the artifact and the page.
- `agent-lab-comparison.e2e.mjs` now covers three strategies and the new rows.

## Why

The metrics must be checkable without trusting the app, so the recomputation shares no code with it.

## Validation

- On `main` after the previous parts merged, with a dev server using `USE_MOCK_TOOLS=true` and no
  model or provider keys: single-agent 70 checks, comparison 155 and revision 77, all passing on
  desktop and phone. Evidence is under the ignored `output/playwright/`.

## Notes for the next person

Run the dev server with no model or provider keys. The E2Es are not part of CI.
