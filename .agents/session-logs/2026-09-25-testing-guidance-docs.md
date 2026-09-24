---
date: 2026-09-25
author: Codex
branch: main
pr: none
area: docs and agent skills
contract-impact: none
---

# Align docs and skills with E2E-first testing guidance

## What changed

- Updated development, workspace UI and roadmap testing guidance.
- Aligned provider, feature-wiring, pre-push, code-review and UI verification skills.
- Recorded the testing policy in an Agent Note.

## Why

The prior guidance steered new work toward isolated tests, while the requested policy prefers complete user flows and reproducible evidence.

## Validation

- `pnpm verify:docs` — passed after fixing the new Agent Note link.
- `pnpm verify:protected` — passed.
- `npx prettier --check` on changed docs, skills, note and log — passed after formatting the pre-push skill.
- `git diff --check` — passed.

## Notes for the next person

- The repository has no checked-in E2E runner; current Vitest and CI checks remain documented as existing regression checks.
