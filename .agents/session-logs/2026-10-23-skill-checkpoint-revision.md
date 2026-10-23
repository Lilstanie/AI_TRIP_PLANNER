---
date: 2026-10-23
author: Claude Code
branch: docs/skill-checkpoint-revision
pr: none
area: .agents/skills
contract-impact: none
---

# Point the skill review checkpoint at the merged review commit

## What changed

- `skill-maintenance/assets/review-checkpoint.json`: `reviewedRevision` moves from `10a6a8f5` to the
  squash commit `114388cc` of #595, which contains every correction that review made, including its
  AGENTS.md edit.
- The `better-ui`, `e2e-maintenance` and `ui-verification` summaries record the #586 additions read
  after the review.

## Why

The review commit could not name itself, and #595 edited AGENTS.md after `10a6a8f5`, so `is-due.mjs`
counted its own edit as a convention change. The 2026-10-14 review did the same follow-up.

## Validation

- `is-due.mjs` before the edit reported `conventionChanges 1 / 1`; the result after the edit is in
  the pull request.
- `pnpm verify:docs` and `pnpm verify:protected` run on this branch; the results are in the pull
  request.

## Notes for the next person

- Twenty-two pull requests merged between `10a6a8f5` and `114388cc`. Only #586 and #593 touched
  skills, and both were read; the others were seen only as advisory drift lines, mostly
  `docs/workspace-ui.md` edits, and were not read one by one.
