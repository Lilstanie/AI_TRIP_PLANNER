---
date: 2026-10-28
author: Claude
branch: docs/import-personal-skills
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Move the commonly used Matt Pocock skills into the repository

## What changed

- Added eight skills under `.agents/skills/`: `ask-matt`, `grill-with-docs`, `to-spec`, `to-tickets`, `implement-spec`, `tdd`, `pr` and `retro`, copied from the account copies.
- Rewrote the descriptions of six of them so they state when to use the skill, as `pnpm verify:docs` requires. Instructions are unchanged.
- Recorded the upstream source in `.agents/skills/THIRD_PARTY_NOTICES.md`.
- Added a row for them to the skill table in `docs/development.md` and its Chinese pair.

## Validation

- `node scripts/verify-docs.mjs`: passed.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: 29 pairs checked, passed.
- `node scripts/verify-protected-files.mjs`: passed.
- `node scripts/verify-branch-name.mjs docs/import-personal-skills`: passed.
- No application tests were run; this change adds skill files and documentation only.

## Notes for the next person

- The upstream licence for mattpocock/skills has not been checked. Confirm it before merging.
- `pr` overlaps `trip-planner-pr-delivery`. The repository skill stays the source of truth for PRs in this project.
- The account copies are still in place. Edits made in the repository do not sync back to them.
