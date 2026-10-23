---
date: 2026-10-23
author: Claude Code
branch: docs/e2e-traps-and-element-shots
pr: none
area: .agents/skills
contract-impact: none
---

# Two E2E traps and element screenshots for self-checks

## What changed

- `.agents/skills/e2e-maintenance/SKILL.md`: two more traps. The phone tab bar hides points from
  `elementFromPoint` (hit in #596), and `formatRange` sometimes uses a thin space (#599).
- `.agents/skills/ui-verification/SKILL.md`: for self-checks, screenshot only the element; keep
  full-page shots for PR evidence.

## Why

These are retro items 3 and 5 from 2026-10-22, which Joey approved. Each trap cost a rerun. Full-page
screenshots of 120–400 KB were read into context only to check one element.

## Validation

- `pnpm verify:docs` passes, and Prettier finds no formatting changes.
