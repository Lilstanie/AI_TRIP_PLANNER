---
date: 2026-10-14
author: Claude Code
branch: docs/skill-review-oct
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Review skills against PRs #311–#337, retire stage1-submission, recheck deepseek upstream

## What changed

- Removed `stage1-submission`; `pre-push-checks` now points `submission/stage1/**` at its README, and
  the skill tables in `docs/development.md` and its Chinese pair drop the link.
- `e2e-maintenance`: the generated `output/e2e/ci-integration-<run>/` path no longer reads as missing,
  and cleanup guidance reflects #321's automatic removal of owned build resources.
- `add-provider`: a fallback checks its own configuration before engaging, and date windows use the
  destination's local calendar, from the two #333 bug-fix notes.
- `THIRD_PARTY_NOTICES.md`: deepseek-harness compared again at `d7432673`; nothing applied.

## Why

Stage 1 was due 2026-10-04 and only the comment cleanup (#292) touched it since; the user chose
removal. Drift prompts for `agent-experience`, `libraries-dev`, `translate-docs` and
`pre-push-checks` were read and need no change. Recurring session-log lessons (SHA-bound CI, one
feature per PR) are already in `pre-push-checks` and `review-trip-planner`. Closed-unmerged #322,
#224, #194 and #193 add no unstated rule.

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs` (26 pairs, `docs/development.md` re-recorded after
  matching edits) and `pnpm verify:protected` passed.
- `check-skills.mjs`: no missing path or broken command; 5 of 22 drift prompts remain, all reviewed.
- Prettier on the changed Markdown files.

## Notes for the next person

- This is not a completed full review: no `review-checkpoint.json` was recorded, because not every
  skill was re-read end to end. `is-due.mjs` still reports a review due.
