---
date: 2026-10-31
author: Claude Code
branch: docs/TP-204-merge-gate
pr: none
area: .agents/skills
contract-impact: none
---

# The PR delivery skill merges only when every check and status on the head is green

## What changed

- `.agents/skills/trip-planner-pr-delivery/SKILL.md` step 5: the status line also reads commit
  statuses (Vercel), counts unfinished runs as not green, and prints how far the head is behind main.
- Step 5 done condition: `bad=[]` and `behind=0`; a stale head is updated and re-run first.
- Step 6: re-run the status line right before the merge call, because owner bypass skips the
  required checks.

## Why

On 2026-10-31 #840, #846, #848, #849 and #850 merged with a red Vercel status ("Deployment rate
limited"); the old status line read only check runs. #773 and #802 merged on CI from 2026-10-28 and
2026-10-30, 60 and 50 commits behind main. Main's GitHub Actions CI stayed green on every merge.

## Validation

- Ran the new status line on #850 (`bad=[Vercel:failure]`) and #773 (`behind=60`).
- `pnpm verify:docs`, Prettier on the changed files: see the PR Evidence section.

## Notes for the next person

Vercel's daily deployment limit is shared by previews and production; every push uses one.
