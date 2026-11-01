---
date: 2026-11-01
author: Claude Code (for Joey)
branch: docs/TP-242-retro-2026-11-01
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Skills and demo runbook follow the 2026-11-01 retro (TP-242)

## What changed

- `trip-planner-pr-delivery`: a setting change is settled in one decision card (entry points,
  default, deployed-site availability); parallel green PRs merge in PR-number order instead of each
  merging main as soon as another lands.
- `ui-verification`: new "Live provider runs" section: verify live on the deployed site through the
  `/sign-in` passcode after merge; a Remote Control worktree holding a copied `.env.local` is removed.
- `review-trip-planner`: copy that promises a behaviour needs code that does it.
- `docs/demo-runbook.md` (+ zh): the Clerk demo account and the admin passcode side by side, and a
  note to change the public passcodes after the demonstration.

## Why

The retro (`/mnt/project-files/retro/2026-11-01-day-retro.md`) found the data-mode switch shipped
three times (#874, #883, #887), live checks that hit three dead ends before reaching the deployed
site, about seven green CI runs redone after other merges, and #886 copy with no code behind it.

## Validation

- `pnpm verify:docs`: Agent Notes, skills and Markdown links are valid.
- `pnpm verify:pairs`: 35 documentation pairs checked.
- `pnpm verify:protected`: rules hold.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs`: no added helper-copy classes.
- Prettier on the changed files.

## Notes for the next person

The memory-index rule from the retro lives in project memory, not in a repo skill.
