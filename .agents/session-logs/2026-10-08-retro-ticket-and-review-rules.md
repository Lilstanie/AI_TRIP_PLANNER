---
date: 2026-10-08
author: Claude Opus 5.5 (with C / @HeadmasterEggy)
branch: chore/retro-oct-7-fixes
pr: none
area: docs/agents, .agents/skills, .github
contract-impact: none
---

# Ticket, review and translation rules from the 2026-10-07 retro

## What changed

- `docs/agents/issue-tracker.md` and its Chinese pair: a "Writing a ticket" section. Tickets name the
  protected files they touch, never waive the Agent Note for `packages/shared/src`, and are closed by a
  `Closes #N` pull request.
- `.github/pull_request_template.md`: the Motivation comment asks for `Closes #N`.
- `code-review` skill: a new or changed licence or notice file must agree with every existing notice.
- `translate-docs` skill: how to resolve a merge conflict in `.agents/translation-pairs.json`.

## Why

The 2026-10-07 run that resolved #218–#228 lost one round to approval that was written only in an
issue. #226 said no Agent Note was needed, which `verify:protected` contradicts. #168 and #174 stayed
open after their PRs merged. A second THIRD_PARTY_NOTICES file disagreed with the first, and every
parallel merge conflicted in `translation-pairs.json`. Joey asked for all retro items on 2026-10-08,
including the `.github/` change.

## Validation

`pnpm verify:docs`, `pnpm verify:pairs` (24 pairs) and `prettier --check` on the touched files pass.

## Notes for the next person

The retro is `/mnt/project-files/retro/2026-10-07-open-issues-retro.md` in the project files, outside
the repo. Package lint, the changed-files Prettier check and the E2E runner's key skip arrive on the same
branch in separate commits.
