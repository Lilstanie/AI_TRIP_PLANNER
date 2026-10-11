---
date: 2026-10-11
author: Codex
branch: main
pr: none
area: .agents/notes, .agents/session-logs
contract-impact: none
---

# Review E2E reliability and React performance

## What changed

- Added a [proposed review](../notes/proposed/testing/2026-10-11-e2e-react-performance-review.md)
  with code evidence, priorities, failure scenarios and open decisions.
- Used both project framework skills and grill-with-docs; delegated independent read-only
  browser/test-tool and React inspections, then checked the reported code paths.

## Why

The next implementation scope needs evidence and explicit choices while preserving the current
E2E-first policy, isolated CLI and package boundaries.

## Validation

- `node apps/web/tests/e2e/run.mjs doctor --json`: exit 1, blocked; Chromium missing/inaccessible.
- `node apps/web/tests/e2e/run.mjs list --json`: exit 0; 2 supported and 41 unsupported journeys.
- Static inspection only; no test suite, build, live provider call or performance sampling.

## Notes for the next person

- Proposed scope awaits the grilling discussion; runtime changes have not been made.
- CI changes require explicit authorization for the protected `.github` files.
- Production changes should update affected docs and relevant implemented decisions at that time.
- Existing dirty files and earlier session logs were preserved.
