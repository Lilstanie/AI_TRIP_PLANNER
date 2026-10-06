---
date: 2026-10-07
author: Claude
branch: docs/skills-review-2026-10-07
pr: none
area: .agents/skills
contract-impact: none
---

# Stop counting issues the latest skill change already absorbed

## What changed

- `.agents/skills/skill-maintenance/scripts/is-due.mjs`: issues named in the commits of the
  baseline skill change (for a merge, the merged branch's commits) are not counted as closed issues.
- `.agents/skills/skill-maintenance/SKILL.md`: step 0 says so.

## Why

The merge of #183 updated `better-writing` and `ui-verification` and closed #175–#190 seconds later,
so the next day's check reported 14 closed issues and a review due for work the skills already
covered. With the fix it reports 4 (#177, #179–#181, whose commits name no issue), below the threshold.

## Validation

- Reviewed the 14 issues and the skill diff in #183: no skill needs a further change.
- `is-due.mjs` on `5f6855e`: no review due; on the squash baseline `bdfd1b6`: still counts later issues.
- `check-skills.mjs`: no missing path or broken command.
- `pnpm verify:docs`, `pnpm verify:protected`, Prettier: passed. `pnpm test:scripts`: 26/26.

## Notes for the next person

Issues closed by a merge whose commits never mention them are still counted; reference the issue
in a commit message or the squash title to keep the count honest.
