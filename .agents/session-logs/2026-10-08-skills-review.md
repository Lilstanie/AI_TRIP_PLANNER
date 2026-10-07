---
date: 2026-10-08
author: Claude
branch: docs/skills-review-2026-10-08
pr: none
area: .agents/skills
contract-impact: none
---

# Update phone-shell guidance after #183 merged, and count merge-commit pull requests

## What changed

- `ui-verification`, `better-layout`: the phone shell is on `main`, so drop "on branches containing
  #183" and the "until it merges" pointer; run the phone walks with
  `pnpm --filter @trip/web e2e phone-shell --prod`.
- `skill-maintenance/scripts/is-due.mjs` and its table: count `Merge pull request #N` commits as
  merged pull requests, not only squash commits ending in `(#N)`.

## Why

The daily check came due on a convention commit (#216) and two Agent Note commits (#212, #214). It
counted 1 merged pull request although six had merged, because the team now merges with merge
commits. The new notes (selection ids on proposal items, intra-city legs) and the #216 wording change
contradict no skill.

## Validation

- `check-skills.mjs`: no missing path or broken command.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, Prettier on changed files: passed.
- `pnpm test:scripts`: 26/26.

## Notes for the next person

Real-device acceptance of the phone shell is still open in #182.
