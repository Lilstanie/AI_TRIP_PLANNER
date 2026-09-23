---
date: 2026-09-24
author: Codex
branch: main
pr: none
area: .agents/skills, .agents/notes
contract-impact: none
---

# Add an end-to-end feature wiring skill

## What changed

- Added `.agents/skills/end-to-end-feature-wiring/SKILL.md` for tracing behavior across producers, wrappers, contracts, state and consumers.
- Added `.agents/notes/implemented/process/2026-09-24-end-to-end-feature-wiring.md` with the decision and evidence from PRs #53, #55, #56 and #59.

## Why

Recent PRs repeatedly found data or behavior that worked in one layer but was dropped before it reached its consumer. A dedicated implementation skill addresses this earlier in the workflow than code review alone.

## Validation

- `pnpm verify:docs`: pass.
- `pnpm verify:protected`: pass relative to `origin/main`.
- `npx prettier --check` on the new skill and Agent Note: pass.

## Notes for the next person

The new skill complements `code-review`; it covers implementation tracing across boundaries.
