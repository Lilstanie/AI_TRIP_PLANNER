---
date: 2026-10-15
author: Claude Code
branch: docs/pr-template-match-pr-skill
pr: none
area: .github, .agents/notes
contract-impact: none
---

# Make the pull request template match the /pr template

## What changed

- `.github/pull_request_template.md`: replaced with the `/pr` skill's template, byte for byte.
- `.agents/notes/implemented/process/2026-10-14-delivery-workflow-rules.md`: the template fact now
  describes those placeholders.

## Why

The user asked for the repository template to use the same format as `/pr`.

## Validation

- `diff` against the template block in the `/pr` skill: identical.
- `pnpm verify:docs`, `pnpm verify:protected` and Prettier on the changed files: see the pull request.

## Notes for the next person

The old "No runnable before/after" instruction is gone from the template; the `/pr` skill's Evidence
section still asks for concrete before and after evidence.
