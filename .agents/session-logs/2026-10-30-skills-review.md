---
date: 2026-10-30
author: Claude
branch: docs/TP-161-skills-review
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Review the skills against the PRs merged since 2026-10-28

## What changed

- `trip-planner-pr-delivery`: step 5 accepts `blocked` when only the code-owner approval (#799) is missing; step 6 states the owners' bypass and who must approve other members' PRs.
- Deleted `pr` (duplicate of the delivery skill's step 4 and the PR template) and `grill-with-docs` (it only called two skills that are not in the repository); removed them from the `docs/development.md` skill table and its Chinese pair.
- `tdd` and `implement-spec` now carry the CLAUDE.md E2E-first rule (failure modes, E2E, `scripts/redgreen.mjs`); `retro` points at `review-trip-planner` and the repository's checks instead of the missing `CODING_STANDARDS.md`; `ask-matt` routes only to skills in the repository.
- `better-layout` covers the desktop Trip workspace (#740, #752, #771, #772) and the glass rule; `docs/development.md` names the account `code-review` skill.
- `check-skills.mjs` ignores example branch names, diff statistics and quoted code fragments; the skill-maintenance CLI E2E asserts it.

## Why

`is-due.mjs` had reported a review due on every run since #754 added eight skills, because the checkpoint covered only the old set.

## Validation

See the PR Evidence section.

## Notes for the next person

- A follow-up PR must record the review checkpoint at this PR's squash commit (the reviewed set differs from `origin/main` before this PR, so it cannot be recorded here), as #627 did for #595.
- The daily skill-review scheduled task no longer exists; recreate it once the checkpoint lands.
